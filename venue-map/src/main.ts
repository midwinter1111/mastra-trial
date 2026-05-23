import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/tokens.css'
import './styles/base.css'

localStorage.removeItem('venuemap:state:v1')

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
