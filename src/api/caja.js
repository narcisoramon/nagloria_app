import client from './client'

export const cajaApi = {
  verificar: () => client.get('/apertura-cajas/caja-abierta'),
  abrir: (data) => client.post('/apertura-cajas/abrir', data),
  cerrar: (data) => client.post('/cierre-cajas/cerrar', data),
}
