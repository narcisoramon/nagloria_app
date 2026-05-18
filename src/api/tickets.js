import client from './client'

export const ticketsApi = {
  crear: (data) => client.post('/tickets', data),
  listar: (params) => client.get('/tickets', { params }),
  ver: (id) => client.get(`/tickets/${id}`),
  anular: (id, motivo) => client.post(`/tickets/${id}/anular`, { motivo }),
  cobrar: (id, data) => client.post(`/tickets/${id}/cobrar`, data),
}
