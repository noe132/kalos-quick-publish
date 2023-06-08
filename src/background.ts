interface TabStateItem {
  prompt: string
  img: Array<number>
}

const midJourney = /https:\/\/www\.midjourney\.com\/app\/jobs\/.*/i
const kalosUploadPage = 'https://test.prsdev.club/upload'
const uploadState = new Map<number, TabStateItem>()

chrome.tabs.onUpdated.addListener((tabId, _info, tab) => {
  const match = !!tab.url && midJourney.test(tab.url)
  if (match) {
    chrome.action.setIcon({
      path: '/images/1.png',
      tabId,
    })
  }
})

chrome.tabs.onActivated.addListener(async (params) => {
  try {
    const tabId = params.tabId
    const tab = await chrome.tabs.get(tabId)
    const match = !!tab.url && midJourney.test(tab.url)
    if (match) {
      chrome.action.setIcon({
        path: '/images/1.png',
        tabId,
      })
    }
  } catch (e) {

  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  uploadState.delete(tabId)
})

chrome.runtime.onMessage.addListener(((request: any, sender: chrome.runtime.MessageSender, _sendResponse: any) => {
  const data = request as SendMessageData
  // console.log(sender.tab ? 'from a content script:' + sender.tab.url : 'from the extension')
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
      console.log('request', item)
      if (/Firefox\/\d+/.test(navigator.userAgent)) {
        chrome.scripting.executeScript({
          target: { tabId },
          func: ((img: Array<number>, prompt: string) => {
            const acceptImgs = (window as any).wrappedJSObject.document.acceptImgs
            if (acceptImgs) {
              const w = (window as any).wrappedJSObject
              acceptImgs(w.JSON.parse(JSON.stringify({
                img,
                prompt,
              })))
              console.log('2')
            }
          }) as any,
          args: [item.img, item.prompt],
        })
      } else {
        chrome.scripting.executeScript({
          target: { tabId },
          func: ((img: Array<number>, prompt: string) => {
            console.log({ img, prompt })
            const acceptImgs = (document as any).acceptImgs
            console.log(acceptImgs)
            if (acceptImgs) {
              acceptImgs({
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
