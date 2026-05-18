// 音乐请求常量
// 集中维护预设 Meting API 和网络超时时间

export const DEFAULT_TOOL_NAME = 'play_netease_music_as_voice'

export const PRESET_METING_APIS = [
  'https://api.injahow.cn/meting/',
  'https://api.qijieya.cn/meting/',
  'https://api.moeyao.cn/meting/',
  'https://meting.jinghuashang.cn/',
  'https://meting.qjqq.cn/',
  'https://api.crowya.com/meting/',
  'https://meting-api.mlj-dragon.cn/meting/',
  'https://api.amarea.cn/meting/'
]

export const SEARCH_TIMEOUT_MS = 5000

export const SOURCE_TIMEOUT_MS = 5000

export const DOWNLOAD_TIMEOUT_MS = 15000

export const REQUEST_TIMEOUT_REASON = 'chatluna-music-request-timeout'
