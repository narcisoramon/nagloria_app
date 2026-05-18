import client from './client'

export const productosApi = {
  listar: (params) => client.get('/productos', { params }),
  categorias: (params) => client.get('/categorias-productos', { params }),
}
