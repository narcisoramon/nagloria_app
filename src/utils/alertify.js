import alertify from 'alertifyjs'
import 'alertifyjs/build/css/alertify.css'
import 'alertifyjs/build/css/themes/default.css'

alertify.set('notifier', 'position', 'top-right')
alertify.set('notifier', 'delay', 5)

export function noti(type, message) {
  alertify[type](message)
}

export function alertar(message, onOk) {
  alertify.alert(message, onOk)
}

export function confirmar(message, onConfirm, onCancel) {
  alertify.confirm(message, onConfirm, onCancel).set('labels', { ok: 'Sí', cancel: 'No' })
}
