// ============================================================
//  MEXITAN POS — Módulo de Impresión Bluetooth
//  Optimizado para impresoras térmicas de 58mm (estándar seguro)
// ============================================================

let _printerDevice = null;
let _printerChar = null;
let _usbDevice = null;
let _usbEndpoint = null;
let _lastPedido = null;

// Configuración de Chunks para evitar "GATT operation failed"
// 20 bytes es el MTU estándar más compatible para BLE
const BLE_CHUNK_SIZE = 20;
const BLE_CHUNK_DELAY = 15; // ms

function updPrinterUI() {
  const connectedBT = !!_printerDevice;
  const connectedUSB = !!_usbDevice;
  const connected = connectedBT || connectedUSB;
  
  const statusEl = document.getElementById('printerStatus');
  const btnConnectBT = document.getElementById('btnConectarPrinter');
  const btnConnectUSB = document.getElementById('btnConectarUSB');
  const btnDisconnect = document.getElementById('btnDesconectarPrinter');
  
  if (statusEl) {
    if (connectedBT) {
      statusEl.textContent = `✓ ${t('printer_conn_bt') || 'Conectada (BT):'} ${_printerDevice.name}`;
      statusEl.style.color = 'var(--v)';
    } else if (connectedUSB) {
      statusEl.textContent = `✓ ${t('printer_conn_usb') || 'Conectada (USB):'} ${_usbDevice.productName || 'USB Printer'}`;
      statusEl.style.color = 'var(--v)';
    } else {
      statusEl.textContent = (t('cfg_printer_none') || 'Sin impresora conectada');
      statusEl.style.color = 'var(--s)';
    }
  }
  
  if (btnConnectBT) btnConnectBT.style.display = connected ? 'none' : '';
  if (btnConnectUSB) btnConnectUSB.style.display = connected ? 'none' : '';
  if (btnDisconnect) btnDisconnect.style.display = connected ? '' : 'none';
}

async function conectarImpresora() {
  if (!navigator.bluetooth) {
    const errEl = document.getElementById('printerErr');
    if (errEl) {
      errEl.textContent = t('printer_no_bluetooth') || 'Este navegador no soporta Bluetooth. Usa Chrome en Android o Windows.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    const errEl = document.getElementById('printerErr');
    if (errEl) errEl.style.display = 'none';

    console.log('Solicitando dispositivo Bluetooth...');
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',  // Genérico POS
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // Rongta / Otros
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // ISCC
        '0000ff00-0000-1000-8000-00805f9b34fb',  // Varios chinos
        '0000ae30-0000-1000-8000-00805f9b34fb'   // SPRT
      ]
    });

    device.addEventListener('gattserverdisconnected', () => {
      console.warn('Servidor GATT desconectado');
      _printerDevice = null;
      _printerChar = null;
      updPrinterUI();
      if (typeof toast === 'function') toast(t('printer_desc') || 'Impresora desconectada');
    });

    console.log('Conectando al servidor GATT...');
    const server = await device.gatt.connect();

    let char = null;

    // Una sola operación GATT para obtener todos los servicios disponibles.
    // Probar UUIDs uno por uno hace múltiples round-trips y la impresora
    // se desconecta por timeout antes de terminar el escaneo.
    try {
      const services = await server.getPrimaryServices();
      console.log(`Servicios encontrados: ${services.length}`);
      for (const svc of services) {
        try {
          const chars = await svc.getCharacteristics();
          for (const ch of chars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              char = ch;
              console.log('Característica de escritura encontrada:', ch.uuid);
              break;
            }
          }
        } catch (e) { /* servicio sin características accesibles */ }
        if (char) break;
      }
    } catch (e) {
      console.warn('getPrimaryServices() falló, intentando UUIDs conocidos:', e.message);
      // Fallback: probar UUIDs específicos
      const serviceUUIDs = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000ae30-0000-1000-8000-00805f9b34fb'
      ];
      for (const svcUUID of serviceUUIDs) {
        if (char) break;
        try {
          const svc = await server.getPrimaryService(svcUUID);
          const chars = await svc.getCharacteristics();
          for (const ch of chars) {
            if (ch.properties.write || ch.properties.writeWithoutResponse) {
              char = ch;
              break;
            }
          }
        } catch (e2) { /* no disponible */ }
      }
    }

    if (!char) {
      if (typeof toast === 'function') toast(t('printer_no_channel') || 'Canal de impresión no encontrado');
      return;
    }

    _printerDevice = device;
    _printerChar = char;
    updPrinterUI();
    if (typeof toast === 'function') toast((t('printer_conn_succ') || '✓ Conectada:') + ' ' + device.name);

  } catch (e) {
    if (e.name !== 'NotFoundError') {
      console.error('Error de conexión Bluetooth:', e);
      const errEl = document.getElementById('printerErr');
      if (errEl) {
        errEl.textContent = (t('err_gen') || 'Error: ') + e.message;
        errEl.style.display = 'block';
      }
    }
  }
}

async function conectarUSB() {
  if (!navigator.usb) {
    const errEl = document.getElementById('printerErr');
    if (errEl) {
      errEl.textContent = t('printer_no_usb') || 'Este navegador no soporta USB. Usa Chrome en Android o Windows.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    const errEl = document.getElementById('printerErr');
    if (errEl) errEl.style.display = 'none';

    console.log('Solicitando dispositivo USB...');
    const device = await navigator.usb.requestDevice({ filters: [] }); // Permite elegir cualquier dispositivo

    console.log('Conectando a USB:', device.productName);
    await device.open();
    await device.selectConfiguration(1);
    
    // Buscar el endpoint de salida (OUT) en la interfaz 0 (común en impresoras)
    // O buscar en todas las interfaces si es necesario
    let endpoint = null;
    let interfaceNum = 0;

    for (const iface of device.configuration.interfaces) {
      for (const alt of iface.alternates) {
        // Buscamos un endpoint de dirección 'out'
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out') {
            endpoint = ep.endpointNumber;
            interfaceNum = iface.interfaceNumber;
            break;
          }
        }
        if (endpoint) break;
      }
      if (endpoint) break;
    }

    if (!endpoint) {
      throw new Error('No se encontró un canal de salida (OUT endpoint) en la impresora.');
    }

    await device.claimInterface(interfaceNum);
    
    _usbDevice = device;
    _usbEndpoint = endpoint;
    updPrinterUI();
    
    if (typeof toast === 'function') toast((t('printer_conn_usb') || '✓ Conectada (USB):') + ' ' + (device.productName || 'Printer'));

  } catch (e) {
    console.error('Error de conexión USB:', e);
    const errEl = document.getElementById('printerErr');
    if (errEl) {
      errEl.textContent = (t('err_gen') || 'Error: ') + e.message;
      errEl.style.display = 'block';
    }
  }
}

function desconectarImpresora() {
  if (_printerDevice && _printerDevice.gatt.connected) {
    _printerDevice.gatt.disconnect();
  }
  if (_usbDevice && _usbDevice.opened) {
    _usbDevice.close();
  }
  _printerDevice = null;
  _printerChar = null;
  _usbDevice = null;
  _usbEndpoint = null;
  updPrinterUI();
}

/**
 * Envía bytes a la impresora usando chunks pequeños y pausas
 */
async function printBytes(bytes) {
  if (!_printerChar && !_usbDevice) return false;
  
  try {
    if (_usbDevice) {
      console.log(`Enviando ${bytes.length} bytes por USB...`);
      await _usbDevice.transferOut(_usbEndpoint, bytes);
      return true;
    }

    if (_printerChar) {
      console.log(`Enviando ${bytes.length} bytes por BT en chunks de ${BLE_CHUNK_SIZE}...`);
      for (let i = 0; i < bytes.length; i += BLE_CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + BLE_CHUNK_SIZE);
        if (_printerChar.properties.writeWithoutResponse) {
          await _printerChar.writeValueWithoutResponse(chunk);
        } else {
          await _printerChar.writeValue(chunk);
        }
        if (BLE_CHUNK_DELAY > 0) {
          await new Promise(r => setTimeout(r, BLE_CHUNK_DELAY));
        }
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error durante el envío de datos:', e);
    if (typeof toast === 'function') toast((t('err_imprimir') || 'Error al imprimir: ') + e.message);
    return false;
  }
}

async function imprimirTicket() {
  if (!_lastPedido) {
    if (typeof toast === 'function') toast(t('err_no_pedido_imprimir') || 'No hay pedido para imprimir');
    return;
  }
  
  if (!_printerChar && !_usbDevice) {
    if (typeof toast === 'function') toast(t('err_printer_no') || 'Impresora no conectada');
    return;
  }

  const btn = document.getElementById('btnImprimirTicket');
  if (btn) {
    btn.textContent = t('printer_printing') || 'Imprimiendo...';
    btn.disabled = true;
  }

  try {
    // Generar bytes (depende de ticket.js)
    const bytes = generarTicketBytes(_lastPedido);
    const ok = await printBytes(bytes);
    
    if (ok) {
      if (typeof closeM === 'function') closeM('mTicket');
      if (typeof toast === 'function') toast(t('ticket_impreso') || '✓ Ticket impreso');
    }
  } catch (e) {
    console.error('Error en imprimirTicket:', e);
  } finally {
    if (btn) {
      btn.textContent = t('btn_imprimir') || '🖨️ Imprimir ticket';
      btn.disabled = false;
    }
  }
}

/**
 * Abre el modal de reimpresión para un pedido específico
 */
async function reimprimir(pedidoId) {
  try {
    const desde = document.getElementById('hdesde').value;
    const hasta = document.getElementById('hhasta').value;
    
    if (typeof getPedidosRango !== 'function') return;
    
    const pedidos = await getPedidosRango(desde, hasta);
    const pedido = pedidos.find(p => (p.id || '') === pedidoId);
    
    if (!pedido) {
      if (typeof toast === 'function') toast(t('err_no_pedido_imprimir') || 'Pedido no encontrado');
      return;
    }
    
    _lastPedido = pedido;
    const pagoLabel = pedido.tipoPago === 'tarjeta' ? '💳 ' + t('pago_tarjeta') : '💵 ' + t('pago_efectivo');
    const total = pedido.totalConPropina || pedido.total;
    const infoEl = document.getElementById('mTicketInfo');
    
    if (infoEl) {
      infoEl.innerHTML = `<strong>${escapeHTML(pedido.mesa)}</strong>${pedido.cliente && pedido.cliente !== t('sin_nombre') ? ' — ' + escapeHTML(pedido.cliente) : ''}<div class="mtotal">$${total}</div>${pagoLabel} · ${pedido.fecha} ${pedido.hora}`;
    }
    
    const btnImp = document.getElementById('btnImprimirTicket');
    if (btnImp) btnImp.style.display = (_printerChar || _usbDevice) ? '' : 'none';
    
    if (typeof openM === 'function') openM('mTicket');
    else document.getElementById('mTicket').classList.add('open');
    
  } catch (e) {
    console.error('Error en reimprimir:', e);
    if (typeof toast === 'function') toast((t('err_gen') || 'Error: ') + e.message);
  }
}
