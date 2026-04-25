# Mexitán POS

Sistema interno de punto de venta y gestión de pedidos para Mexitán Food & Drink.

## Características

- Autenticación segura mediante Firebase Auth (acceso solo a personal autorizado).
- Gestión de mesas activas y pedidos en tiempo real (Firestore).
- Toma de pedidos con notas por producto y búsqueda de menú.
- Sistema de cobro con selección de método de pago (Efectivo / Tarjeta) y propinas (5 / 10 / 15 / 20 % o monto libre).
- Tracking de cobrador: cada venta registra quién la cobró.
- Aviso de edición simultánea: si dos personas abren la misma mesa a la vez, el sistema notifica.
- Generación de tickets e impresión térmica vía Bluetooth (Web Bluetooth API).
- Historial de pedidos con filtro por rango de fechas y badge de cobrador.
- Resumen contable diario/periódico con desglose por producto y método de pago.
- Exportación de datos a CSV para Excel.
- Envío de reportes por correo electrónico (EmailJS).
- Editor de menú integrado: categorías y productos editables en tiempo real.
- Interfaz completamente bilingüe (Español / Inglés), con manual adicional en Urdu.
- Diseño responsivo optimizado para móvil (Android viejo e iPhone), con navegación inferior y soporte de safe area.
- PWA instalable con Service Worker (cache network-first).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML / CSS / JS Vanilla (SPA) |
| Autenticación | Firebase Auth |
| Base de datos | Firestore (tiempo real) |
| Hosting | Firebase Hosting |
| Impresión | Web Bluetooth API + ESC/POS |
| Correo | EmailJS |
| Fuentes | Google Fonts — Barlow / Barlow Condensed |

## Estructura de archivos

```
mexitan-pos/
├── index.html          # Aplicación principal (toda la lógica SPA)
├── style.css           # Diseño system, variables de marca, responsive
├── ticket.js           # Config del ticket de impresión (editable)
├── bluetooth.js        # Módulo de impresión Bluetooth (ESC/POS)
├── sw.js               # Service Worker (cache network-first)
├── manifest.json       # PWA manifest
├── Logo.png            # Logo de la marca
├── logo-ticket.bmp     # Logo para impresora térmica (BMP monocromático)
├── manual_es.html      # Manual de usuario en español
├── manual_en.html      # Manual de usuario en inglés
├── manual_ur.html      # Manual de usuario en urdu
└── icons/              # Iconos PWA (192px, 512px)
```

## Seguridad

- Firebase Security Rules: `request.auth != null` — solo usuarios autenticados acceden a datos.
- Registro público deshabilitado en Firebase Auth.
- `serviceAccount.json` y `ventas.json` en `.gitignore` — nunca se suben al repositorio.
- Acceso público de solo lectura al documento `config/menu` para el menú público en GitHub Pages.

## Ramas

| Rama | Uso |
|---|---|
| `main` | Producción — lo que está desplegado en Firebase Hosting |
| `dev` | Desarrollo activo |

## Despliegue

```bash
firebase deploy --only hosting
```
