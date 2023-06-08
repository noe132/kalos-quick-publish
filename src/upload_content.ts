const uploadMain = async () => {
  for (let i = 0; i < 200; i += 1) {
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    const promptInput = document.querySelector<HTMLInputElement>('#product-prompt')
    if (!fileInput || !promptInput) {
      await new Promise((rs) => setTimeout(rs, 500))
      continue
    }
    chrome.runtime.sendMessage({
      type: 'upload-data-request',
    })
    break
  }
}

uploadMain()
