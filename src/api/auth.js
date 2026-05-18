import client from './client'

export const authApi = {
  login: (credentials) => client.post('/login', credentials),
  logout: () => client.post('/logout'),
  perfil: () => client.get('/perfil'),
}