import client from './client'

export const recipientesApi = {
  listar: (params) => client.get('/recipientes', { params }),
}
