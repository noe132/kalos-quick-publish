console.log('content script')

const main = async () => {
  for (let i = 0; i < 20; i += 1) {
    const imgSrc = document.querySelector('#imageContainer img.modalImage[class*="cursor-zoom-in"]')?.getAttribute('src')
    const prompt = document.querySelector('#modalPrompt')?.textContent?.trim()
    if (!imgSrc || !prompt) {
      await new Promise((rs) => setTimeout(rs, 500))
      continue
    }
    console.log(document.querySelector('#imageContainer img.modalImage'))
    console.log(imgSrc)
    const imageData = await (await fetch(imgSrc)).arrayBuffer()
    console.log(imageData.byteLength)
    const imageDataView = new Uint8Array(imageData)
    console.log(imageDataView)
    const data: NotifyMidJourneyData = {
      type: 'midjourney-data',
      data: {
        img: Array.from(imageDataView),
        prompt,
      },
    }
    chrome.runtime.sendMessage(data)
    break
  }
}

main()
