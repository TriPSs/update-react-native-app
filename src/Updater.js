import { NativeModules, Platform } from 'react-native'
import RNFS from 'react-native-fs'

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

    if (latestRelease) {
      const latestVersion = latestRelease.tag_name.replace('v', '').split('.').join('')
      const currentVersion = Updater.UpdateRNApp.versionName.replace('v', '').split('.').join('')

      if (latestVersion > currentVersion) {
        const apkUrl = latestRelease.assets.find(asset => asset.browser_download_url.indexOf('.apk') > -1)

        if (apkUrl) {
          this.fire('onUpdateAvailable', (yesUpdate) => {
            if (yesUpdate) {
              this.downloadApk(apkUrl)
            }
          })
        }
      }
    }
  }

  downloadApk = (apkUrl) => {
    const progress = (data) => {
      const percentage = ((100 * data.bytesWritten) / data.contentLength) | 0

      this.fire('onProgress', percentage)
    }

    const downloadDest = `${RNFS.CachesDirectoryPath}/NewApp.apk`

    const downloadFile = RNFS.downloadFile({
      fromUrl        : apkUrl,
      toFile         : downloadDest,
      begin          : (response) => this.fire('onDownloadStart'),
      progress,
      background     : true,
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
