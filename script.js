// ============================================
// CONFIGURACIÓN DE CRIPTOMONEDAS
// ============================================
const criptos = [
    { id: "bitcoin", nombre: "Bitcoin", simbolo: "BTC", binanceSymbol: "BTCUSDT" },
    { id: "ethereum", nombre: "Ethereum", simbolo: "ETH", binanceSymbol: "ETHUSDT" },
    { id: "binancecoin", nombre: "BNB", simbolo: "BNB", binanceSymbol: "BNBUSDT" },
    { id: "solana", nombre: "Solana", simbolo: "SOL", binanceSymbol: "SOLUSDT" },
    { id: "dogecoin", nombre: "Dogecoin", simbolo: "DOGE", binanceSymbol: "DOGEUSDT" }
];

// ============================================
// VARIABLES GLOBALES (Con valores por defecto seguros)
// ============================================
window.saldoUsuario = 100000; 
window.holdings = {};
window.datosCriptos = {};
window.historialOperaciones = [];

// Bandera de seguridad: Evita guardar si no hemos cargado
let datosCargados = false; 

let chartSimuladorInstance = null;
let temporalidadActual = '30m';

// Inicializar holdings a 0
criptos.forEach(cripto => {
    window.holdings[cripto.id] = 0;
});

// ============================================
// CARGA Y GUARDADO DE DATOS (CORREGIDO)
// ============================================
function guardarDatos() {
    // SEGURIDAD: No guardar si aún no hemos intentado cargar (evita sobrescribir con ceros)
    if (!datosCargados) return;

    // 1. Guardar en LocalStorage (Siempre)
    localStorage.setItem('cryptosim-data', JSON.stringify({
        saldo: window.saldoUsuario,
        holdings: window.holdings,
        datosCriptos: window.datosCriptos,
        historialOperaciones: window.historialOperaciones
    }));
    
    // 2. Guardar en Nube (Si hay usuario)
    if (typeof guardarEnNube === 'function' && typeof usuarioActual !== 'undefined' && usuarioActual) {
        guardarEnNube();
    }
    
    actualizarSaldoTotalCuenta();
}

function cargarDatos() {
    // Si hay usuario logueado, auth-config.js se encarga.
    if (typeof usuarioActual !== 'undefined' && usuarioActual) return;

    // Intentar leer LocalStorage
    const datosRaw = localStorage.getItem('cryptosim-data');
    
    if (datosRaw) {
        try {
            const datos = JSON.parse(datosRaw);
            
            // Cargar saldo
            window.saldoUsuario = (datos.saldo !== undefined) ? datos.saldo : 100000;
            
            // Cargar holdings (fusionando con los ceros iniciales para no perder claves)
            const holdingsGuardados = datos.holdings || {};
            window.holdings = { ...window.holdings, ...holdingsGuardados };
            
            window.datosCriptos = datos.datosCriptos || {};
            window.historialOperaciones = datos.historialOperaciones || [];
            
            console.log("Datos locales cargados correctamente");
        } catch (e) {
            console.error("Error leyendo datos locales, reiniciando...", e);
            window.saldoUsuario = 100000;
        }
    } else {
        console.log("No hay datos locales. Iniciando cuenta nueva de invitado.");
        window.saldoUsuario = 100000;
        // Reiniciar holdings a 0
        criptos.forEach(c => window.holdings[c.id] = 0);
    }

    // Marcar como cargado para permitir guardado futuro
    datosCargados = true;
    actualizarSaldoTotalCuenta();
}

// ============================================
// FUNCIÓN RESETEAR (Para cuenta.html)
// ============================================
function resetearApp() {
    Swal.fire({
        title: '¿Reiniciar Cuenta?',
        text: "Se borrará todo tu progreso local y en la nube (si estás conectado).",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0ecb81',
        cancelButtonColor: '#f6465d',
        confirmButtonText: 'Sí, borrar todo',
        background: '#181a20', color: '#eaecef'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Restableciendo...',
                didOpen: () => { Swal.showLoading() },
                background: '#181a20', color: '#eaecef'
            });

            // 1. Borrar Local
            localStorage.removeItem('cryptosim-data');
            
            // 2. Borrar Nube (Resetear a 100k)
            if (typeof db !== 'undefined' && typeof usuarioActual !== 'undefined' && usuarioActual) {
                try {
                    await db.collection('usuarios').doc(usuarioActual.uid).set({
                        saldo: 100000,
                        holdings: {},
                        historial: [],
                        ultimaActualizacion: new Date()
                    });
                } catch (e) { console.error(e); }
            }

            setTimeout(() => { location.reload(); }, 1000);
        }
    });
}

// ============================================
// UTILIDADES Y UI
// ============================================
function formatearDinero(cantidad) {
    const numero = parseFloat(cantidad);
    if (isNaN(numero)) return '$0,00';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(numero); 
}

function actualizarSaldoTotalCuenta() {
    let valorCriptos = 0;
    
    if (window.holdings) {
        criptos.forEach(c => {
            const cantidad = window.holdings[c.id] || 0;
            const precio = (window.datosCriptos && window.datosCriptos[c.id]) ? window.datosCriptos[c.id].precio : 0;
            valorCriptos += cantidad * precio;
        });
    }

    const saldoLiquido = parseFloat(window.saldoUsuario) || 0; 
    const patrimonioTotal = saldoLiquido + valorCriptos;

    const elSaldoFijo = document.getElementById('saldo-cuenta-fijo');
    if (elSaldoFijo) elSaldoFijo.textContent = formatearDinero(saldoLiquido);

    const elPatrimonioLive = document.getElementById('patrimonio-cuenta-live');
    if (elPatrimonioLive) elPatrimonioLive.textContent = formatearDinero(patrimonioTotal);

    const elTotalSimulador = document.getElementById('balance-total-cuenta');
    if (elTotalSimulador) elTotalSimulador.textContent = formatearDinero(patrimonioTotal);

    const elSaldoSimulador = document.getElementById('saldo-disponible');
    if (elSaldoSimulador) elSaldoSimulador.textContent = formatearDinero(saldoLiquido);
    
    const elCartera = document.getElementById('cartera');
    if (elCartera) elCartera.textContent = formatearDinero(patrimonioTotal);
    
    const elSaldoIndex = document.getElementById('saldo-disponible-texto');
    if (elSaldoIndex) elSaldoIndex.textContent = formatearDinero(saldoLiquido);
}

function actualizarVisualmente() {
    actualizarSaldoTotalCuenta();
}

// ============================================
// OBTENER PRECIOS
// ============================================
async function obtenerPreciosSimples() {
    try {
        const ids = criptos.map(c => c.id).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();

        criptos.forEach(cripto => {
            if (data[cripto.id]) {
                window.datosCriptos[cripto.id] = {
                    precio: data[cripto.id].usd,
                    cambio24h: data[cripto.id].usd_24h_change
                };
            }
        });
        
        // Solo guardamos si ya cargamos datos previamente (para no sobrescribir con vacío)
        if (datosCargados) {
            guardarDatos();
        }
        
        actualizarSaldoTotalCuenta();
        
        const selector = document.getElementById('selector-cripto');
        if (selector) actualizarVistaSimulador(selector.value);
        if (typeof actualizarTabla === 'function') actualizarTabla();

    } catch (error) { console.warn('API Error', error); }
}

// ============================================
// GRÁFICOS
// ============================================
async function obtenerDatosBinance(criptoId, intervalo) {
    const cripto = criptos.find(c => c.id === criptoId);
    if (!cripto || !cripto.binanceSymbol) return [];
    try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cripto.binanceSymbol}&interval=${intervalo}&limit=50`);
        const data = await res.json();
        return data.map(d => ({
            x: new Date(d[0]),
            y: [parseFloat(d[1]), parseFloat(d[2]), parseFloat(d[3]), parseFloat(d[4])]
        }));
    } catch (e) { return []; }
}

async function actualizarGraficoTrading(criptoId, intervalo) {
    const contenedor = document.getElementById('chartTrading');
    if (!contenedor || typeof ApexCharts === 'undefined') return;

    const seriesData = await obtenerDatosBinance(criptoId, intervalo);
    if (!seriesData.length) return;

    const velaActual = seriesData[seriesData.length - 1];
    const precioApertura = velaActual.y[0];
    const precioActual = velaActual.y[3];
    const porcentajeCambio = ((precioActual - precioApertura) / precioApertura) * 100;

    const cambioEl = document.getElementById('cambio-header');
    if (cambioEl) {
        const signo = porcentajeCambio >= 0 ? '+' : '';
        cambioEl.textContent = `${signo}${porcentajeCambio.toFixed(2)}%`;
        cambioEl.className = 'cambio-header ' + (porcentajeCambio >= 0 ? 'cambio-positivo' : 'cambio-negativo');
    }
    
    const precioHeader = document.getElementById('precio-header');
    if(precioHeader) precioHeader.textContent = formatearDinero(precioActual);

    if (chartSimuladorInstance) chartSimuladorInstance.destroy();

    const options = {
        series: [{ name: 'Precio', data: seriesData }],
        chart: { type: 'candlestick', height: '70%', background: 'transparent', toolbar: { show: false } },
        theme: { mode: 'dark' },
        plotOptions: { candlestick: { colors: { upward: '#0ecb81', downward: '#f6465d' } } },
        xaxis: { type: 'datetime', labels: { style: { colors: '#848e9c' } } },
        yaxis: { labels: { style: { colors: '#848e9c' }, formatter: (val) => "$" + val.toFixed(2) } },
        grid: { borderColor: '#2b3139', strokeDashArray: 4 },
        tooltip: { enabled: true, custom: function() { return ''; } }
    };

    chartSimuladorInstance = new ApexCharts(contenedor, options);
    chartSimuladorInstance.render();
}

function cambiarTemporalidadBinance(intervalo) {
    temporalidadActual = intervalo;
    document.querySelectorAll('.btn-timeframe').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    actualizarGraficoTrading(document.getElementById('selector-cripto').value, intervalo);
}

// ============================================
// VISTA Y OPERACIONES
// ============================================
async function actualizarVistaSimulador(criptoId) {
    const cripto = criptos.find(c => c.id === criptoId);
    const datos = window.datosCriptos[criptoId];
    if (!cripto || !datos) return;

    const symbolHoldEl = document.getElementById('simbolo-holding');
    if (symbolHoldEl) symbolHoldEl.textContent = cripto.simbolo;

    const holdingEl = document.getElementById('holdings-actual');
    if(holdingEl) holdingEl.textContent = (window.holdings[criptoId] || 0).toFixed(6);
    
    const valorTotalEl = document.getElementById('valor-total');
    if(valorTotalEl) valorTotalEl.textContent = formatearDinero((window.holdings[criptoId] || 0) * datos.precio);
    
    const inputPrecioCompra = document.getElementById('precio-compra');
    const inputPrecioVenta = document.getElementById('precio-venta');
    if (inputPrecioCompra) inputPrecioCompra.value = datos.precio;
    if (inputPrecioVenta) inputPrecioVenta.value = datos.precio;

    const simCompra = document.getElementById('simbolo-compra');
    const simVenta = document.getElementById('simbolo-venta');
    if(simCompra) simCompra.textContent = cripto.simbolo;
    if(simVenta) simVenta.textContent = cripto.simbolo;
    
    actualizarSaldoTotalCuenta();
    renderizarHistorialIzquierdo();
}

function ejecutarCompraRapida() {
    const id = document.getElementById('selector-cripto').value;
    const cantidad = parseFloat(document.getElementById('cantidad-compra').value);
    
    if (!cantidad || cantidad <= 0) return Swal.fire('Error', 'Cantidad inválida', 'error');
    
    let costo = cantidad * window.datosCriptos[id].precio;
    if (costo > window.saldoUsuario && (costo - window.saldoUsuario) < 0.01) costo = window.saldoUsuario;
    if (costo > window.saldoUsuario) return Swal.fire('Error', 'Saldo insuficiente', 'error');

    window.saldoUsuario -= costo;
    if (window.saldoUsuario < 0) window.saldoUsuario = 0; 
    
    window.holdings[id] = (window.holdings[id] || 0) + cantidad;
    
    registrarOperacion('COMPRA', id, window.datosCriptos[id].precio, cantidad);
    finalizarOperacion(id, 'Compra exitosa');
}

function ejecutarVentaRapida() {
    const id = document.getElementById('selector-cripto').value;
    let cantidad = parseFloat(document.getElementById('cantidad-venta').value);
    
    if (!cantidad || cantidad <= 0) return Swal.fire('Error', 'Cantidad inválida', 'error');

    const misHoldings = window.holdings[id] || 0;
    if (cantidad > misHoldings && (cantidad - misHoldings) < 0.000001) cantidad = misHoldings;
    if (cantidad > misHoldings) return Swal.fire('Error', 'No tienes suficientes criptos', 'error');

    const ganancia = cantidad * window.datosCriptos[id].precio;
    window.saldoUsuario += ganancia;
    window.holdings[id] -= cantidad;
    if (window.holdings[id] < 0) window.holdings[id] = 0;

    registrarOperacion('VENTA', id, window.datosCriptos[id].precio, cantidad);
    finalizarOperacion(id, 'Venta exitosa');
}

function finalizarOperacion(id, mensaje) {
    Swal.fire({
        icon: 'success', title: mensaje, toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
        background: '#1e2329', color: '#fff'
    });
    document.getElementById('cantidad-compra').value = '';
    document.getElementById('total-compra').value = '';
    document.getElementById('cantidad-venta').value = '';
    document.getElementById('total-venta').value = '';
    
    guardarDatos();
    actualizarVistaSimulador(id);
}

function registrarOperacion(tipo, criptoId, precio, cantidad) {
    const cripto = criptos.find(c => c.id === criptoId);
    window.historialOperaciones.unshift({
        tipo: tipo, simbolo: cripto.simbolo, precio: precio, cantidad: cantidad,
        total: precio * cantidad, hora: new Date().toLocaleTimeString()
    });
    if (window.historialOperaciones.length > 50) window.historialOperaciones.pop();
}

function renderizarHistorialIzquierdo() {
    const contenedor = document.getElementById('historial-panel-izquierdo');
    if (!contenedor) return;

    const selector = document.getElementById('selector-cripto');
    const criptoIdActual = selector ? selector.value : null;
    const objCripto = criptos.find(c => c.id === criptoIdActual);
    const simboloActual = objCripto ? objCripto.simbolo : '';

    const operacionesFiltradas = window.historialOperaciones.filter(op => op.simbolo === simboloActual);

    if (operacionesFiltradas.length === 0) {
        contenedor.innerHTML = `<p class="text-muted text-center small mt-4">Sin operaciones de ${simboloActual}</p>`;
        return;
    }

    let html = '';
    operacionesFiltradas.forEach(op => {
        const colorClass = op.tipo === 'COMPRA' ? 'text-success' : 'text-danger';
        html += `
            <div class="orderbook-row" style="padding: 8px 0; border-bottom: 1px solid #2b3139;">
                <span class="${colorClass}" style="font-weight:bold;">${op.tipo}</span>
                <span>${op.precio.toFixed(2)}</span>
                <span>${op.cantidad.toFixed(4)}</span>
            </div>`;
    });
    contenedor.innerHTML = html;
}

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('load', async function() {
    // 1. Cargar datos locales primero
    cargarDatos();
    
    // 2. Configurar selectores
    const selector = document.getElementById('selector-cripto');
    if (selector) {
        selector.innerHTML = criptos.map(c => 
            `<option value="${c.id}">${c.nombre} (${c.simbolo})</option>`
        ).join('');

        const criptoSeleccionada = sessionStorage.getItem('cryptosim-selected');
        if (criptoSeleccionada) {
            selector.value = criptoSeleccionada;
            sessionStorage.removeItem('cryptosim-selected');
        }

        selector.addEventListener('change', function() {
            actualizarVistaSimulador(this.value);
            actualizarGraficoTrading(this.value, temporalidadActual);
        });
    }

    // 3. Obtener precios
    await obtenerPreciosSimples();
    
    if (selector) {
        actualizarVistaSimulador(selector.value);
        actualizarGraficoTrading(selector.value, temporalidadActual);
    }
    
    // 4. Listeners inputs
    ['compra', 'venta'].forEach(tipo => {
        const inputCantidad = document.getElementById('cantidad-' + tipo);
        const inputTotal = document.getElementById('total-' + tipo);
        if(!inputCantidad) return;
        
        inputCantidad.addEventListener('input', function() {
            const id = document.getElementById('selector-cripto').value;
            const precio = window.datosCriptos[id]?.precio || 0;
            let cantidad = parseFloat(this.value);
            if (isNaN(cantidad) || cantidad < 0) cantidad = 0;
            const total = (cantidad * precio);
            inputTotal.value = isNaN(total) || total === 0 ? '' : total.toFixed(2);
        });
        
        inputTotal.addEventListener('input', function() {
            const id = document.getElementById('selector-cripto').value;
            const precio = window.datosCriptos[id]?.precio || 0;
            let total = parseFloat(this.value);
            if (isNaN(total) || total < 0) total = 0;
            if (precio > 0) inputCantidad.value = (total / precio).toFixed(8);
        });
    });

    setInterval(async () => { await obtenerPreciosSimples(); }, 3000);
});