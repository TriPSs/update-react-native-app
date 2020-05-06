import { NativeModules, Platform } from 'react-native'
import RNFS from 'react-native-fs'
import semverMax from 'semver-max'

export default class Updater {

  static UpdateRNApp = NativeModules.UpdateRNApp

  options
  jobId = -1

  releasesUri = 'https://api.github.com/repos/{ownerAndRepo}/releases'

  constructor(options) {
    this.options = options
  }

  get = (url, success, error) => {
    fetch(url)
      .then((response) => response.json())
      .then(success)
      .catch(error)
  }

  getApkVersion = () => {
    if (this.jobId !== -1) {
      return
    }

    if (!this.options.repo) {
      return
    }

    this.get(
      this.releasesUri.replace('{ownerAndRepo}', this.options.repo),
      this.getApkVersionSuccess,
      this.getVersionError,
    )
  }

  getApkVersionSuccess = (releases) => {
    const latestRelease = releases.length > 0 ? releases[0] : null

    // Only if we have a latest release and it's higher then the current one
    if (latestRelease && semverMax(latestRelease.tag_name, Updater.UpdateRNApp.versionName) !== Updater.UpdateRNApp.versionName) {
      const apkAsset = latestRelease.assets.find(asset => asset.browser_download_url.indexOf('.apk') > -1)

      if (apkAsset) {
        this.fire('onUpdateAvailable', latestRelease, () => {
          this.downloadApk(apkAsset)
        })
      }
    }
  }

  downloadApk = (apkAsset) => {
    const progress = (data) => {
      const percentage = ((100 * data.bytesWritten) / data.contentLength) | 0

      this.fire('onProgress', percentage)
    }

    const downloadDest = `${RNFS.ExternalCachesDirectoryPath}/${apkAsset.name}`

    const downloadFile = RNFS.downloadFile({
      fromUrl: apkAsset.browser_download_url,
      toFile: downloadDest,
      begin: (response) => this.fire('onDownloadStart'),
      progress,
      background: true,
      progressDivider: 1,
    })

    this.jobId = downloadFile.jobId

    downloadFile.promise.then((response) => {
      this.fire('onDownloadEnd')

      Updater.UpdateRNApp.installApk(downloadDest)

      this.jobId = -1

    }).catch((error) => {
      this.fire('onDownloadError', error)

      this.jobId = -1
    })
  }

  getVersionError = (err) => {}

  checkUpdate = () => {
    if (Platform.OS === 'android') {
      this.getApkVersion()
    }
  }

  fire = (func, ...args) => {
    if (this.options[func]) {
      this.options[func].apply(null, args)
    }
  }

}
