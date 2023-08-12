interface TabStateItem {
  prompt: string
  img: Array<number>
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
const kalosUploadPage = 'https://kalos.art/upload'
const uploadState = new Map<number, TabStateItem>()

chrome.tabs.onUpdated.addListener((tabId, _info, tab) => {
  const match = !!tab.url && midJourney.test(tab.url)
  chrome.action.setIcon({
    path: match ? activeIconSet : unactiveIconSet,
    tabId,
  })
})

chrome.tabs.onActivated.addListener(async (params) => {
  try {
    const tabId = params.tabId
    const tab = await chrome.tabs.get(tabId)
    const match = !!tab.url && midJourney.test(tab.url)
    chrome.action.setIcon({
      path: match ? activeIconSet : unactiveIconSet,
      tabId,
    })
  } catch (e) {

  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  uploadState.delete(tabId)
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
      if (/Firefox\/\d+/.test(navigator.userAgent)) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: ((img: Array<number>, prompt: string) => {
            const acceptImgs = (window as any).wrappedJSObject.document.acceptImgs
            if (acceptImgs) {
              const w = (window as any).wrappedJSObject
              acceptImgs(w.JSON.parse(JSON.stringify({
                model: 'Midjourney',
                img,
                prompt,
              })))
            }
          }) as any,
          args: [item.img, item.prompt],
        })
      } else {
        chrome.scripting.executeScript({
          target: { tabId },
          func: ((img: Array<number>, prompt: string) => {
            const acceptImgs = (document as any).acceptImgs
            if (acceptImgs) {
              acceptImgs({
                model: 'Midjourney',
                img,
                prompt,
              })
            }
          }) as any,
          args: [item.img, item.prompt],
          world: 'MAIN',
        })
      }
    }
  }

  run()
}) as any)

chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0]
    const activeTabId = activeTab.id
    if (!activeTabId || !activeTab.url) {
      return
    }

    if (midJourney.test(activeTab.url)) {
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
  })
})
