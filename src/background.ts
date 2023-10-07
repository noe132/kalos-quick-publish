interface UploadStateItem {
  prompt: string
  img: Array<number>
}
interface PostUploadStateItem {
  postBox: string
  url: string
  title: string
  img: Array<{
    src: string
    ext: string
    data: string
  }>
  total: number
  current: number
}

const activeIconSet = {
  '16': '/images/chrome_ext_active_16.png',
  '32': '/images/chrome_ext_active_32.png',
  '48': '/images/chrome_ext_active_48.png',
  '128': '/images/chrome_ext_active_128.png',
  '512': '/images/chrome_ext_active_512.png',
}
const unactiveIconSet = {
  '16': '/images/chrome_ext_unactive_16.png',
  '32': '/images/chrome_ext_unactive_32.png',
  '48': '/images/chrome_ext_unactive_48.png',
  '128': '/images/chrome_ext_unactive_128.png',
  '512': '/images/chrome_ext_unactive_512.png',
}
const midJourney = /https:\/\/www\.midjourney\.com\/app\/jobs\/.*/i
const wechatPost = /https:\/\/mp.weixin.qq.com\/s.*/i
const zhihuAnswerPost = /https:\/\/www.zhihu.com\/question\/.+?\/answer\/.+?/i
const zhihuZhuanlanPost = /https:\/\/zhuanlan.zhihu.com\/p\/.+?/i
const pages = [
  midJourney,
  wechatPost,
  zhihuAnswerPost,
  zhihuZhuanlanPost,
]
const kalosUploadPage = 'https://kalos.art/upload'
const kalosPostUploadPage = 'https://kalos.art/upload-post'
const uploadState = new Map<number, UploadStateItem>()
const postPullState = new Map<number, PostUploadStateItem>()
const postUploadState = new Map<number, PostUploadStateItem>()
const BATCH_SIZE = 2

const setIconCallback = () => {
  const error = (chrome.runtime as any).lastError
  if (typeof error?.message !== 'string') { return }
  if (!error.message.startsWith('No tab with id')) {
    console.log('error')
    console.error(error.message)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({
    path: unactiveIconSet,
  })
})

chrome.tabs.onUpdated.addListener((tabId, _info, tab) => {
  const url = tab.url
  const match = !!url && pages.some((v) => v.test(url))
  chrome.action.setIcon({
    path: match ? activeIconSet : unactiveIconSet,
    tabId,
  }, setIconCallback)
})

chrome.tabs.onActivated.addListener(async (params) => {
  const tabId = params.tabId
  const tab = await new Promise<chrome.tabs.Tab | null>((rs) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = (chrome.runtime as any).lastError
      rs(error ? null : tab)
    })
  })
  if (!tab) { return }
  const url = tab.url
  const match = !!url && pages.some((v) => v.test(url))
  chrome.action.setIcon({
    path: match ? activeIconSet : unactiveIconSet,
    tabId,
  }, setIconCallback)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  uploadState.delete(tabId)
  postUploadState.delete(tabId)
})

chrome.runtime.onMessage.addListener(((request: any, sender: chrome.runtime.MessageSender, _sendResponse: any) => {
  const data = request as SendMessageData
  const tabId = sender.tab?.id
  if (!tabId) { return }

  const run = async () => {
    if (data.type === 'midjourney-data-pull') {
      const tab = await chrome.tabs.create({
        url: kalosUploadPage,
      })
      if (tab.id) {
        uploadState.set(tab.id, data.data)
      }
    }

    if (data.type === 'upload-data-request') {
      const item = uploadState.get(tabId)
      if (!item) { return }

      const isFirefox = /Firefox\/\d+/.test(navigator.userAgent)
      chrome.scripting.executeScript({
        target: { tabId },
        func: ((img: Array<number>, prompt: string) => {
          const isFirefox = /Firefox\/\d+/.test(navigator.userAgent)
          const acceptImgs = isFirefox
            ? (window as any).wrappedJSObject.document.acceptImgs
            : (document as any).acceptImgs
          const w = (window as any).wrappedJSObject
          if (acceptImgs) {
            const data = isFirefox
              ? w.JSON.parse(JSON.stringify({
                model: 'Midjourney',
                img,
                prompt,
              }))
              : {
                model: 'Midjourney',
                img,
                prompt,
              }
            acceptImgs(data)
          }
        }) as any,
        args: [item.img, item.prompt],
        world: isFirefox ? 'ISOLATED' : 'MAIN',
      })
    }

    if (data.type === 'post-data-from-source-page') {
      setTimeout(() => {
        postPullState.delete(data.data.id)
      }, 20000)
      const item = postPullState.get(data.data.id) || {
        img: [],
        url: '',
        title: '',
        postBox: '',
        total: data.data.total,
        current: 0,
      }
      item.postBox = data.data.postBox || item.postBox
      item.url = data.data.url || item.url
      item.title = data.data.title || item.title
      data.data.img.forEach((v) => {
        item.img.push(v)
      })
      item.current += 1
      postPullState.set(data.data.id, item)
      if (item.current === item.total) {
        const tab = await chrome.tabs.create({
          url: kalosPostUploadPage,
        })
        if (tab.id) {
          const tabId = tab.id
          postUploadState.set(tabId, item)
          setTimeout(() => postUploadState.delete(tabId), 20000)
        }
        postPullState.delete(data.data.id)
      }
    }

    if (data.type === 'post-data-request-from-kalos') {
      const item = postUploadState.get(tabId)
      if (!item) { return }

      const isFirefox = /Firefox\/\d+/.test(navigator.userAgent)
      const batch = Math.max(Math.ceil(item.img.length / BATCH_SIZE), 1)
      for (let i = 0; i < batch; i += 1) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: ((itemData: PostUploadStateItem) => {
            const isFirefox = /Firefox\/\d+/.test(navigator.userAgent)
            const acceptPostData = isFirefox
              ? (window as any).wrappedJSObject.document.acceptPostData
              : (document as any).acceptPostData
            const w = (window as any).wrappedJSObject
            const data = isFirefox
              ? w.JSON.parse(JSON.stringify(itemData))
              : itemData
            if (acceptPostData) {
              acceptPostData(data)
            }
          }) as any,
          args: [{
            ...i === 0 ? {
              postBox: item.postBox,
              url: item.url,
              title: item.title,
            } : {},
            total: batch,
            current: i,
            img: item.img.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
          }],
          world: isFirefox ? 'ISOLATED' : 'MAIN',
        })
      }
      postUploadState.delete(tabId)
    }
  }

  run()
}) as any)

chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const error = (chrome.runtime as any).lastError
    if (error) { return }
    const activeTab = tabs[0]
    const activeTabId = activeTab.id
    const url = activeTab.url
    if (!activeTabId || !url) {
      return
    }

    if (midJourney.test(url)) {
      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: async () => {
          const imgSrc = document.querySelector('#imageContainer img.modalImage[class*="cursor-zoom-in"]')?.getAttribute('src')
          const prompt = document.querySelector('#modalPrompt')?.textContent?.trim()
          if (!imgSrc || !prompt) {
            return
          }
          const imageData = await (await fetch(imgSrc)).arrayBuffer()
          const imageDataView = new Uint8Array(imageData)
          const data: NotifyMidJourneyDataPull = {
            type: 'midjourney-data-pull',
            data: {
              img: Array.from(imageDataView),
              prompt,
            },
          }
          chrome.runtime.sendMessage(data)
        },
      })
    }

    const postPages = [
      [wechatPost, 'wechat'],
      [zhihuAnswerPost, 'zhihu'],
      [zhihuZhuanlanPost, 'zhihuzhuanlan'],
    ] as const
    const pageMatch = postPages.find((v) => v[0].test(url))
    if (pageMatch) {
      const pageType = pageMatch[1]
      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: (async (BATCH_SIZE: number, pageType: typeof postPages[number][1]) => {
          let postBox
          if (pageType === 'wechat') {
            postBox = document.querySelector('#js_content')
          }
          if (pageType === 'zhihu') {
            postBox = document.querySelector('.AnswerCard .RichContent .RichContent-inner')
          }
          if (pageType === 'zhihuzhuanlan') {
            postBox = document.querySelector('.Post-content .Post-Main .Post-RichTextContainer')
          }
          if (!postBox) { return }
          postBox = postBox.cloneNode(true) as Element
          postBox.querySelectorAll('noscript').forEach((v) => v.remove())
          let title = document.title

          if (pageType === 'wechat') {
            title = document.querySelector('#activity-name')?.textContent?.trim() || title
          }
          if (pageType === 'zhihu') {
            title = document.querySelector('.QuestionHeader-title')?.textContent?.trim() || title
          }

          if (pageType === 'zhihuzhuanlan') {
            title = document.querySelector('.Post-Title')?.textContent?.trim() || title
          }

          const links = Array.from(postBox.querySelectorAll('a'))
          links.forEach((v) => {
            const zhihuLinkHead = 'https://link.zhihu.com/?target='
            if (v.href.startsWith(zhihuLinkHead)) {
              const target = v.href.slice(zhihuLinkHead.length)
              v.href = decodeURIComponent(target)
            }
          })
          const images = Array.from(postBox.querySelectorAll('img'))
          const div = document.createElement('div')
          div.style.position = 'fixed'
          div.style.top = '0'
          div.style.right = '0'
          div.style.zIndex = '100000'
          div.style.background = 'white'
          div.style.color = 'black'
          div.style.padding = '4px 6px'
          div.style.fontSize = '20px'
          document.body.append(div)
          let fetched = 0
          div.innerHTML = `${fetched} / ${images.length} images fetched`
          const imgs = await Promise.all(images.map(async (v) => {
            const run = async () => {
              let src = ''
              let ext = ''
              if (pageType === 'wechat') {
                src = v.dataset.src || v.src
                ext = v.dataset.type || 'jpg'
              }
              if (pageType === 'zhihu') {
                src = v.dataset.original || v.dataset.actualsrc || v.src
                ext = 'jpg'
              }

              if (pageType === 'zhihuzhuanlan') {
                src = v.dataset.original || v.dataset.actualsrc || v.src
                ext = 'jpg'
              }

              if (!src) { return null }
              if (src.startsWith('http://')) {
                src = 'https://' + src.slice(7)
              }
              v.title = ''
              if (src.startsWith('data:')) { return null }

              v.src = src
              v.setAttribute('src', src)
              const buffer = await fetch(src).then((v) => v.arrayBuffer()).catch(() => null)
              if (!buffer) { return null }
              // skip file larger than 8MB
              if (buffer.byteLength > 8 * 2 ** 20) { return null }

              const base64url = await new Promise<string>((rs) => {
                const reader = new FileReader()
                reader.onload = () => rs(reader.result as string)
                reader.readAsDataURL(new Blob([buffer]))
              })

              return {
                src,
                ext,
                data: base64url.slice(base64url.indexOf(',') + 1),
              }
            }
            const data = await run()
            fetched += 1
            div.innerHTML = `${fetched} / ${images.length} images fetched`
            return data
          }))
          const validImages = imgs.filter(<T>(v: T | null): v is T => !!v)
          div.remove()

          const id = Date.now()
          const batch = Math.ceil(validImages.length / BATCH_SIZE)
          for (let i = 0; i < batch; i += 1) {
            const data: PostDataFromSourcePage = {
              type: 'post-data-from-source-page',
              data: {
                id,
                ...i === 0 ? {
                  postBox: postBox.outerHTML,
                  url: window.location.href,
                  title,
                } : {},
                img: validImages.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
                index: i,
                total: batch,
              },
            }
            chrome.runtime.sendMessage(data)
          }
        }) as any,
        args: [BATCH_SIZE, pageType],
      })
    }
  })
})
