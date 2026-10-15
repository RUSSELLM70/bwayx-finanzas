# BWAY X - Finanzas

Finanzas personales para uso diario: responsive (Android, iOS y web) e instalable como PWA. Sin dependencias ni build.

## Ejecutar
    python3 -m http.server 5173     # o: npm start
    # http://localhost:5173  ·  en el celular: http://<IP-de-tu-Mac>:5173 → "Agregar a pantalla de inicio"

## Pruebas
    npm test        # +50 pruebas: lógica, estrategias de deuda, Excel y flujo completo de la app

## Qué incluye
- **Guía de inicio**: 1) lo que ganas (por día o quincena, se acumula) → 2) gastos fijos → 3) análisis.
- **Monedas**: moneda principal + segunda moneda con tipo de cambio (p. ej. colones ↔ dólares). Cada movimiento guarda su tasa.
- **Pagos**: gastos fijos, mínimos de tarjetas y pagos sueltos con estado Pendiente / Pagado / Vencido.
- **Deudas**: tarjetas y préstamos; estrategia avalancha o bola de nieve, comparación contra solo-mínimos,
  y plan para repartir cada pago recibido (obligaciones → mínimos → día a día → ahorro → extra a la deuda prioritaria).
- **Ahorros**: metas con depósitos y retiros.
- **Excel (.xlsx)**: Resumen, Movimientos, Pagos, Ahorros, Deudas y Estrategia, con fórmulas y 4 gráficos nativos.
- **Consejos**: tasa de ahorro, 50/30/20, gastos hormiga, presupuestos, fondo de emergencia, deudas e inversión (educativo).
- Datos solo en el dispositivo (localStorage); copia JSON exportable/importable.
- **Datos seguros en el dispositivo**: localStorage + copia espejo en IndexedDB (autorrecuperación), almacenamiento persistente,
  PIN opcional con cifrado AES-256, avisos para instalar la app y hacer copia de seguridad.
- Campos validados (montos con separador de miles, enteros, texto alfanumérico) y monto en letras.

- **Blindaje de datos**: guardado verificado por lectura, copia espejo + historial de versiones (Ajustes → Restaurar una versión anterior),
  recuperación automática si el dato se daña o el navegador lo vacía, protección contra pisar datos con un estado vacío y contra edición en dos pestañas.

Para regalarla a tu comunidad lee **DEPLOY.md**.
