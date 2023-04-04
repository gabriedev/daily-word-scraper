import { resolve } from 'path'
import {
  INSTAGRAM_API_KEY,
  INSTAGRAM_API_URL,
  NUMBER_OF_REELS,
  PAGE_URI,
  USER_ID
} from './constants.js'
import { promises as fs } from 'fs'
import { selector } from './utils.js'
import { chromium } from 'playwright'
import download from 'download'

const { pathname: root } = new URL('../src', import.meta.url)

async function mapReelFromInstagramReels({ node }, index) {
  const { id, display_url, video_url } = node

  const videofile = `${(index + 1) * 1000}.mp4`
  const imagefile = `${(index + 1) * 1000}.jpg`
  const outputDir = `tmp`

  await download(video_url, resolve(root, outputDir, 'media', videofile))
  await download(display_url, resolve(root, outputDir, 'image', imagefile))

  return {
    id,
    picture: `${outputDir}/image/${imagefile}`,
    media: `${outputDir}/media/${videofile}`
  }
}

async function getReelsFromInstagramApi() {
  const response = await fetch(
    `https://${INSTAGRAM_API_URL}/medias?user_id=${USER_ID}&batch_size=${NUMBER_OF_REELS}`,
    {
      headers: {
        'X-RapidAPI-Key': INSTAGRAM_API_KEY,
        'X-RapidAPI-Host': INSTAGRAM_API_URL
      }
    }
  )
  const { data } = await response.json()

  return await Promise.all(
    data.user.edge_owner_to_timeline_media.edges.map(mapReelFromInstagramReels)
  )
}

async function getDailyWord() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(PAGE_URI)

  const [date, readingOfToday, gospelOfTheDay] = await Promise.all([
    page.textContent('#dataFilter-text'),
    {
      title: await page.textContent(selector(3, 1)),
      book: await page.textContent(selector(3, 2)),
      content: await page.textContent(selector(3, 3))
    },
    {
      title: await page.textContent(selector(4, 1)),
      book: await page.textContent(selector(4, 2)),
      content: await page.textContent(selector(4, 3))
    }
  ])

  await browser.close()

  return { date, readingOfToday, gospelOfTheDay }
}

;(async () => {
  const [dailyWord, reels] = await Promise.all([
    getDailyWord(),
    getReelsFromInstagramApi()
  ])

  await Promise.all([
    await fs.writeFile(resolve('daily.json'), JSON.stringify(dailyWord)),
    await fs.writeFile(resolve('reels.json'), JSON.stringify(reels))
  ])
})()
