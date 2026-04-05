export interface PreviewHUDCallbacks {
  onTimeChange: (hour: number) => void
  onWeatherChange: (type: string) => void
  onSpeedChange: (multiplier: number) => void
  onExit: () => void
}

const WEATHER_OPTIONS = [
  { type: 'clear', label: '☀️ 晴' },
  { type: 'cloudy', label: '⛅ 阴' },
  { type: 'rain', label: '🌧️ 雨' },
  { type: 'snow', label: '❄️ 雪' },
  { type: 'fog', label: '🌫️ 雾' },
  { type: 'storm', label: '⛈️ 暴风' },
]

export class PreviewHUD {
  private el: HTMLElement
  private timeLabel: HTMLSpanElement
  private timeSlider: HTMLInputElement
  private weatherBtns: HTMLButtonElement[] = []
  private speedBtns: HTMLButtonElement[] = []
  private callbacks: PreviewHUDCallbacks
  private currentWeather = 'clear'
  private currentSpeed = 1

  constructor(container: HTMLElement, callbacks: PreviewHUDCallbacks) {
    this.callbacks = callbacks
    this.el = document.createElement('div')
    this.el.className = 'preview-hud'

    // Top bar
    const topBar = document.createElement('div')
    topBar.className = 'preview-hud-top'

    const exitBtn = document.createElement('button')
    exitBtn.className = 'preview-exit-btn'
    exitBtn.innerHTML = '← 退出预览 <span style="opacity:0.5;font-size:11px">(ESC)</span>'
    exitBtn.addEventListener('click', callbacks.onExit)
    topBar.appendChild(exitBtn)

    this.timeLabel = document.createElement('span')
    this.timeLabel.className = 'preview-time-label'
    this.timeLabel.textContent = '10:00'
    topBar.appendChild(this.timeLabel)

    this.el.appendChild(topBar)

    // Bottom bar
    const botBar = document.createElement('div')
    botBar.className = 'preview-hud-bottom'

    // Time slider
    const timeGroup = document.createElement('div')
    timeGroup.className = 'preview-hud-group'
    const sunIcon = document.createElement('span')
    sunIcon.textContent = '☀️'
    timeGroup.appendChild(sunIcon)
    this.timeSlider = document.createElement('input')
    this.timeSlider.type = 'range'
    this.timeSlider.min = '0'
    this.timeSlider.max = '24'
    this.timeSlider.step = '0.1'
    this.timeSlider.value = '10'
    this.timeSlider.className = 'preview-time-slider'
    this.timeSlider.addEventListener('input', () => {
      const h = parseFloat(this.timeSlider.value)
      callbacks.onTimeChange(h)
      this.updateTimeLabel(h)
    })
    timeGroup.appendChild(this.timeSlider)
    const moonIcon = document.createElement('span')
    moonIcon.textContent = '🌙'
    timeGroup.appendChild(moonIcon)
    botBar.appendChild(timeGroup)

    // Weather buttons
    const weatherGroup = document.createElement('div')
    weatherGroup.className = 'preview-hud-group'
    for (const opt of WEATHER_OPTIONS) {
      const btn = document.createElement('button')
      btn.className = 'preview-weather-btn'
      if (opt.type === 'clear') btn.classList.add('active')
      btn.textContent = opt.label
      btn.dataset.weather = opt.type
      btn.addEventListener('click', () => {
        this.currentWeather = opt.type
        this.weatherBtns.forEach(b => b.classList.toggle('active', b.dataset.weather === opt.type))
        callbacks.onWeatherChange(opt.type)
      })
      this.weatherBtns.push(btn)
      weatherGroup.appendChild(btn)
    }
    botBar.appendChild(weatherGroup)

    // Speed buttons
    const speedGroup = document.createElement('div')
    speedGroup.className = 'preview-hud-group'
    const speedLabel = document.createElement('span')
    speedLabel.textContent = '速度:'
    speedLabel.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.6);'
    speedGroup.appendChild(speedLabel)
    for (const spd of [1, 5, 20]) {
      const btn = document.createElement('button')
      btn.className = 'preview-speed-btn'
      if (spd === 1) btn.classList.add('active')
      btn.textContent = `${spd}x`
      btn.addEventListener('click', () => {
        this.currentSpeed = spd
        this.speedBtns.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        callbacks.onSpeedChange(spd)
      })
      this.speedBtns.push(btn)
      speedGroup.appendChild(btn)
    }
    botBar.appendChild(speedGroup)

    this.el.appendChild(botBar)
    container.appendChild(this.el)
  }

  updateTimeLabel(hour: number): void {
    const h = Math.floor(hour) % 24
    const m = Math.floor((hour % 1) * 60)
    this.timeLabel.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  updateTimeSlider(hour: number): void {
    this.timeSlider.value = String(hour % 24)
    this.updateTimeLabel(hour)
  }

  destroy(): void {
    this.el.remove()
  }
}
