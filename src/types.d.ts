declare namespace globalThis {
  interface NotifyMidJourneyDataPull {
    type: 'midjourney-data-pull'
    data: {
      img: Array<number>
      prompt: string
    }
  }

  interface PostDataFromSourcePage {
    type: 'post-data-from-source-page'
    data: {
      id: number
      postBox?: string
      url?: string
      title?: string
      img: Array<{
        src: string
        ext: string
        data: string
      }>
      index: number
      total: number
    }
  }

  interface UploadDataRequest {
    type: 'upload-data-request'
  }
  interface PostUploadDataRequest {
    type: 'post-data-request-from-kalos'
  }

  type SendMessageData = NotifyMidJourneyDataPull
  | UploadDataRequest
  | PostDataFromSourcePage
  | PostUploadDataRequest
}
