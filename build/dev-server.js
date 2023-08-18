const path = require('path')
const fs = require('fs/promises')
const cp = require('child_process')
const chokidar = require('chokidar')
const { rimraf } = require('rimraf')

const root = path.join(__dirname, '..')
const dist = path.join(root, 'dist')
const imagesDir = path.join(root, 'images')
const packagedDir = path.join(root, 'packaged')
const firefoxDir = path.join(root, 'packaged/firefox')
const chromeDir = path.join(root, 'packaged/chrome')
const firefoxImagesDir = path.join(root, 'packaged/firefox/images')
const chromeImagesDir = path.join(root, 'packaged/chrome/images')

const watchCopyManifest = () => {
  const manifestFile = path.join(root, 'manifest.json')
  const watcher = chokidar.watch(manifestFile)
  const copy = async (p) => {
    // await new Promise(rs => setTimeout(rs, 100))
    // await fs.copyFile(p, p.replace(root, firefoxDir))
    console.log('copy', p)
    const file = await fs.readFile(manifestFile)
    try {
      const manifestChrome = JSON.parse(file.toString())
      const manifestFirefox = JSON.parse(file.toString())
      manifestChrome.background = {
        service_worker: manifestChrome.background.scripts[0],
      }
      delete manifestChrome.browser_specific_settings
      fs.writeFile(
        p.replace(root, chromeDir),
        JSON.stringify(manifestChrome, null, 2),
      )
      fs.writeFile(
        p.replace(root, firefoxDir),
        JSON.stringify(manifestFirefox, null, 2),
      )
    } catch (e) {
      if (!file.length) { return }
      console.error(e)
    }
  }
  const unlink = (p) => {
    fs.unlink(p.replace(root, firefoxDir))
    fs.unlink(p.replace(root, chromeDir))
  }

  watcher
    .on('add', (p) => copy(p))
    .on('change', (p) => copy(p))
    .on('unlink', (p) => unlink(p))
}

const watchCopyJs = () => {
  const watcher = chokidar.watch(path.join(dist, '**/*'))
  const copy = (p) => {
    console.log('copy', p)
    fs.copyFile(p, p.replace(dist, firefoxDir))
    fs.copyFile(p, p.replace(dist, chromeDir))
  }
  const unlink = (p) => {
    fs.unlink(p.replace(dist, firefoxDir))
    fs.unlink(p.replace(dist, chromeDir))
  }

  watcher
    .on('add', (p) => copy(p))
    .on('change', (p) => copy(p))
    .on('unlink', (p) => unlink(p))
}

const watchCopyImages = () => {
  const watcher = chokidar.watch(path.join(imagesDir, '**/*'))
  const copy = (p) => {
    console.log('copy', p)
    fs.copyFile(p, p.replace(imagesDir, firefoxImagesDir))
    fs.copyFile(p, p.replace(imagesDir, chromeImagesDir))
  }
  const unlink = (p) => {
    fs.unlink(p.replace(imagesDir, firefoxImagesDir))
    fs.unlink(p.replace(imagesDir, chromeImagesDir))
  }

  watcher
    .on('add', (p) => copy(p))
    .on('change', (p) => copy(p))
    .on('unlink', (p) => unlink(p))
}

const main = async () => {
  await rimraf(dist)
  await rimraf(packagedDir)
  await fs.mkdir(dist, { recursive: true })
  await fs.mkdir(firefoxImagesDir, { recursive: true })
  await fs.mkdir(chromeImagesDir, { recursive: true })
  const tsc = cp.exec(
    'yarn tsc --watch',
    {
      cwd: path.join(__dirname, '..'),
    },
  )
  tsc.stdout.pipe(process.stdout)
  tsc.stderr.pipe(process.stderr)
  watchCopyManifest()
  watchCopyJs()
  watchCopyImages()
}

main()
