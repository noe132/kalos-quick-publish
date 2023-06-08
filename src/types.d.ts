declare namespace globalThis {
  interface NotifyMidJourneyDataPull {
    type: 'midjourney-data-pull'
    data: {
      img: Array<number>
      prompt: string
    }
  }

  interface UploadDataRequest {
    type: 'upload-data-request'
  }

  type SendMessageData = NotifyMidJourneyDataPull | UploadDataRequest
}
