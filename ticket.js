// ============================================================
//  Gestion OS — Configuracion del ticket de impresion
//  Archivo editable independiente del sistema principal
//  Modificar este archivo no afecta la base de datos ni el POS
// ============================================================

const TICKET_CONFIG = {

  // ── DATOS DEL NEGOCIO ─────────────────────────────────────
  negocio: {
    nombre: '',          // Aparece grande y en negritas arriba
    subtitulo: '',     // Linea debajo del nombre
    direccion: '16 de Septiembre 18, La Cruz Coyuya, Iztacalco, CDMX, 08310',
    telefono: '',                 // Dejar vacio para no mostrar
    whatsapp: 'WA: 55 4817 8005',                 // Ej: 'WA: 55 1234 5678'
    instagram: '@mexitan_cdmx',
    web: 'mexitan-foodanddrink.github.io/',                 // Ej: 'mexitan.com'
  },

  // ── SEPARADORES ───────────────────────────────────────────
  separador: {
    doble: '================================',
    simple: '--------------------------------',
    punteado: '................................',
  },

  // ── ANCHO DE PAPEL ────────────────────────────────────────
  ancho: 32, // Caracteres por linea en papel de 58mm

  // ── ETIQUETAS ─────────────────────────────────────────────
  etiquetas: {
    mesa: 'Mesa  ',
    cliente: 'Cliente',
    fecha: 'Fecha ',
    hora: 'Hora  ',
    pago: 'Pago  ',
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    subtotal: 'SUBTOTAL',
    propina: 'PROPINA',
    total: 'TOTAL',
    nota: '>',
  },

  // ── PIE DE TICKET ─────────────────────────────────────────
  pie: [
    'Gracias por su visita!',
    '@mexitan_cdmx',
    // 'Conserve su ticket',
    // 'IVA incluido',
  ],

  // ── OPCIONES ──────────────────────────────────────────────
  opciones: {
    mostrar_hora: true,
    mostrar_cliente: false,
    corte_automatico: true,
    saltos_al_final: 3,
  },

  // ── LOGO ──────────────────────────────────────────────────
  // Se carga automaticamente desde logo-ticket.bmp
  // Solo sube el archivo a C:\mexitan-pos\ y haz deploy
  // Especificaciones: BMP monocromatico, 384px ancho, blanco y negro puro
  logo: null,
};

// ============================================================
//  CARGA DE LOGO — automatica al iniciar la app
// ============================================================
async function cargarLogoTicket() {
  try {
    const resp = await fetch('logo-ticket.bmp');
    if (!resp.ok) return;
    TICKET_CONFIG.logo = await resp.arrayBuffer();
    console.log('Logo cargado para impresion de tickets');
  } catch (e) {
    console.warn('logo-ticket.bmp no encontrado — se imprimira sin logo');
  }
}

// ============================================================
//  GENERADOR ESC/POS — No es necesario modificar esta seccion
// ============================================================

function generarTicketBytes(pedido) {
  const cfg = TICKET_CONFIG;
  const ESC = 0x1B;
  const GS = 0x1D;
  const W = cfg.ancho;
  const parts = [];

  const cmd = (...bytes) => parts.push(new Uint8Array(bytes));
  // Codifica en Latin-1 (WPC1252): cada caracter Unicode 0-255 → 1 byte.
  // Evita el problema de UTF-8 donde á (U+00E1) se envía como 2 bytes (0xC3 0xA1)
  // y la impresora lo interpreta como caracteres basura.
  const txt = (str) => {
    const r = new Uint8Array(str.length + 1);
    for (let i = 0; i < str.length; i++) {
      const cp = str.charCodeAt(i);
      r[i] = cp < 256 ? cp : 0x3F; // '?' para caracteres fuera de Latin-1
    }
    r[str.length] = 10;
    parts.push(r);
  };
  const bold = (on) => cmd(ESC, 0x45, on ? 1 : 0);
  const align = (a) => cmd(ESC, 0x61, a === 'c' ? 1 : a === 'r' ? 2 : 0);
  const ljust = (a, b, w) => {
    const pad = Math.max(1, w - a.length - b.length);
    return a + ' '.repeat(pad) + b;
  };

  cmd(ESC, 0x40);       // Inicializar
  cmd(ESC, 0x74, 16);  // Página de caracteres WPC1252 (soporta acentos en español)
  const L = cfg.etiquetas;

  // Logo (si esta disponible)
  if (cfg.logo) {
    try {
      const logoBytes = bmpToEscpos(cfg.logo);
      parts.push(logoBytes);
      txt('');
    } catch (e) { console.warn('Error al imprimir logo:', e); }
  }

  // Encabezado
  align('c');
  bold(true); txt(cfg.negocio.nombre); bold(false);
  if (cfg.negocio.subtitulo) txt(cfg.negocio.subtitulo);
  if (cfg.negocio.direccion) txt(cfg.negocio.direccion);
  if (cfg.negocio.telefono) txt(cfg.negocio.telefono);
  if (cfg.negocio.whatsapp) txt(cfg.negocio.whatsapp);
  txt(cfg.separador.doble);

  // Datos de la orden
  align('l');
  txt(L.mesa + ': ' + pedido.mesa);
  if (cfg.opciones.mostrar_cliente && pedido.cliente && pedido.cliente !== 'Sin nombre') {
    txt(L.cliente + ': ' + pedido.cliente);
  }
  txt(L.fecha + ': ' + pedido.fecha);
  if (cfg.opciones.mostrar_hora) txt(L.hora + '  : ' + pedido.hora);
  txt(L.pago + ': ' + (pedido.tipoPago === 'tarjeta' ? L.tarjeta : L.efectivo));
  txt(cfg.separador.simple);

  // Productos
  Object.entries(pedido.items).forEach(([nombre, v]) => {
    const n = nombre.length > 20 ? nombre.substring(0, 19) + '.' : nombre;
    txt(ljust('  ' + n + ' x' + v.qty, '$' + (v.precio * v.qty), W));
    if (v.notas) txt('  ' + L.nota + ' ' + v.notas);
  });
  txt(cfg.separador.simple);

  // Totales
  bold(true);
  txt(ljust(L.subtotal, '$' + pedido.total, W));
  if (pedido.propina > 0) {
    txt(ljust(L.propina, '$' + pedido.propina, W));
    txt(ljust(L.total, '$' + pedido.totalConPropina, W));
  }
  bold(false);
  txt(cfg.separador.doble);

  // Pie
  align('c');
  cfg.pie.forEach(linea => { if (linea) txt(linea); });
  if (cfg.negocio.web) txt(cfg.negocio.web);

  // Saltos y corte
  parts.push(new Uint8Array(cfg.opciones.saltos_al_final).fill(10));
  if (cfg.opciones.corte_automatico) cmd(GS, 0x56, 0x00);

  const total = parts.reduce((s, a) => s + a.length, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;
  parts.forEach(a => { buffer.set(a, offset); offset += a.length; });
  return buffer;
}

// ============================================================
//  CONVERSION BMP → ESC/POS RASTER
//  Soporta BMP de 1 bit (monocromatico) y 24 bits (color/escala de grises)
//  No es necesario modificar esta funcion
// ============================================================
function bmpToEscpos(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const pixelOffset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const height = view.getInt32(22, true);
  const bitCount = view.getUint16(28, true); // bits por pixel: 1 o 24
  const absHeight = Math.abs(height);
  const topDown = height < 0;
  const printWidth = Math.min(width, 384);
  const byteWidth = Math.ceil(printWidth / 8);
  const GS = 0x1D;
  const result = [];

  // Comando GS v 0 — impresion raster
  result.push(new Uint8Array([
    GS, 0x76, 0x30, 0x00,
    byteWidth & 0xFF, (byteWidth >> 8) & 0xFF,
    absHeight & 0xFF, (absHeight >> 8) & 0xFF
  ]));

  if (bitCount === 1) {
    // BMP monocromatico: 0 = negro (imprimir), 1 = blanco
    const rowBytes = Math.ceil(width / 32) * 4;
    for (let row = 0; row < absHeight; row++) {
      const bmpRow = topDown ? row : (absHeight - 1 - row);
      const rowData = new Uint8Array(byteWidth);
      for (let byte = 0; byte < byteWidth; byte++) {
        let val = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = byte * 8 + bit;
          if (px < printWidth) {
            const byteIdx = pixelOffset + bmpRow * rowBytes + Math.floor(px / 8);
            const bitIdx = 7 - (px % 8);
            if (((view.getUint8(byteIdx) >> bitIdx) & 1) === 0) {
              val |= (1 << (7 - bit));
            }
          }
        }
        rowData[byte] = val;
      }
      result.push(rowData);
    }
  } else if (bitCount === 24) {
    // BMP de 24 bits: convertir a 1 bit usando luminancia (umbral 128)
    const rowBytes = Math.ceil(width * 3 / 4) * 4;
    for (let row = 0; row < absHeight; row++) {
      const bmpRow = topDown ? row : (absHeight - 1 - row);
      const rowData = new Uint8Array(byteWidth);
      for (let byte = 0; byte < byteWidth; byte++) {
        let val = 0;
        for (let bit = 0; bit < 8; bit++) {
          const px = byte * 8 + bit;
          if (px < printWidth) {
            const base = pixelOffset + bmpRow * rowBytes + px * 3;
            const b = view.getUint8(base);
            const g = view.getUint8(base + 1);
            const r = view.getUint8(base + 2);
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 128) val |= (1 << (7 - bit)); // oscuro = imprimir
          }
        }
        rowData[byte] = val;
      }
      result.push(rowData);
    }
  } else {
    console.warn('bmpToEscpos: formato BMP no soportado (bitCount=' + bitCount + '). Usa BMP de 1 o 24 bits.');
  }

  const total = result.reduce((s, a) => s + a.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  result.forEach(a => { buf.set(a, off); off += a.length; });
  return buf;
}
