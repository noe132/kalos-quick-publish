const postUploadMain = async () => {
  for (let i = 0; i < 4 * 60; i += 1) {
    const postPage = document.querySelector('[data-id="post-upload-page"]')
    if (!postPage) {
      await new Promise((rs) => setTimeout(rs, 250))
      continue
    }
    chrome.runtime.sendMessage({
      type: 'post-data-request-from-kalos',
    })
    break
  }
}

postUploadMain()
