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
// VARIABLES GLOBALES (Públicas para la nube)
// ============================================
var saldoUsuario = (typeof saldoUsuario !== 'undefined') ? saldoUsuario : 100000;
var holdings = (typeof holdings !== 'undefined') ? holdings : {};
var datosCriptos = (typeof datosCriptos !== 'undefined') ? datosCriptos : {};
var historialOperaciones = (typeof historialOperaciones !== 'undefined') ? historialOperaciones : [];

// Variables internas del simulador
let chartSimuladorInstance = null;
let temporalidadActual = '30m';

// Inicializar holdings si está vacío
if (Object.keys(holdings).length === 0) {
    criptos.forEach(cripto => {
        holdings[cripto.id] = 0;
    });
}

// ============================================
// CARGA Y GUARDADO DE DATOS
// ============================================
function guardarDatos() {
    localStorage.setItem('cryptosim-data', JSON.stringify({
        saldo: saldoUsuario,
        holdings: holdings,
        datosCriptos: datosCriptos,
        historialOperaciones: historialOperaciones
    }));
    
    if (typeof guardarEnNube === 'function' && typeof usuarioActual !== 'undefined' && usuarioActual) {
        guardarEnNube();
    }
    
    actualizarSaldoTotalCuenta();
}

function cargarDatos() {
    if (typeof usuarioActual !== 'undefined' && usuarioActual) return;

    const datos = JSON.parse(localStorage.getItem('cryptosim-data') || '{}');
    if (datos.saldo !== undefined) {
        saldoUsuario = datos.saldo;
        if (Object.keys(holdings).length === 0) holdings = datos.holdings || holdings;
        datosCriptos = datos.datosCriptos || {};
        historialOperaciones = datos.historialOperaciones || [];
    }
}

// ============================================
// FUNCIÓN RESETEAR (Para cuenta.html)
// ============================================
function resetearApp() {
    Swal.fire({
        title: '¿Resetear Cuenta?',
        text: "Se borrarán todos tus progresos en la NUBE y LOCALES. Volverás a $100,000.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0ecb81',
        cancelButtonColor: '#f6465d',
        confirmButtonText: 'Sí, borrar todo',
        cancelButtonText: 'Cancelar',
        background: '#181a20',
        color: '#eaecef'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Restableciendo...',
                text: 'Sincronizando cambios con Google...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading() },
                background: '#181a20', color: '#eaecef'
            });

            localStorage.removeItem('cryptosim-data');
            
            if (typeof db !== 'undefined' && typeof usuarioActual !== 'undefined' && usuarioActual) {
                try {
                    await db.collection('usuarios').doc(usuarioActual.uid).set({
                        saldo: 100000,
                        holdings: {},
                        historial: [],
                        ultimaActualizacion: new Date()
                    });
                    console.log("Nube forzada a 100k");
                } catch (error) { console.error(error); }
            }

            setTimeout(() => { location.reload(); }, 1500);
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
    
    if (typeof criptos !== 'undefined' && typeof holdings !== 'undefined') {
        criptos.forEach(c => {
            const cantidad = holdings[c.id] || 0;
            const precio = (datosCriptos && datosCriptos[c.id]) ? datosCriptos[c.id].precio : 0;
            valorCriptos += cantidad * precio;
        });
    }

    const saldoLiquido = parseFloat(saldoUsuario) || 0; 
    const patrimonioTotal = saldoLiquido + valorCriptos;

    const elSaldoFijo = document.getElementById('saldo-cuenta-fijo');
    if (elSaldoFijo) elSaldoFijo.textContent = formatearDinero(saldoLiquido);

    const elPatrimonioLive = document.getElementById('patrimonio-cuenta-live');
    if (elPatrimonioLive) elPatrimonioLive.textContent = formatearDinero(patrimonioTotal);

    const elTotalSimulador = document.getElementById('balance-total-cuenta');
    if (elTotalSimulador) elTotalSimulador.textContent = formatearDinero(patrimonioTotal);

    const elSaldoSimulador = document.getElementById('saldo-disponible');
    if (elSaldoSimulador) elSaldoSimulador.textContent = formatearDinero(saldoLiquido);
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
                datosCriptos[cripto.id] = {
                    precio: data[cripto.id].usd,
                    cambio24h: data[cripto.id].usd_24h_change
                };
            }
        });
        
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

    // === CAMBIO REALIZADO AQUÍ PARA EL PORCENTAJE ===
    // Ahora tomamos la última vela (la actual) para calcular el cambio
    const velaActual = seriesData[seriesData.length - 1];
    const precioApertura = velaActual.y[0]; // Precio Open de la vela actual
    const precioActual = velaActual.y[3];   // Precio Close (actual) de la vela actual
    
    // Calculamos el porcentaje
    const porcentajeCambio = ((precioActual - precioApertura) / precioApertura) * 100;
    // ================================================

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
    const datos = datosCriptos[criptoId];
    if (!cripto || !datos) return;

    // Actualizar Textos
    const symbolHoldEl = document.getElementById('simbolo-holding');
    if (symbolHoldEl) symbolHoldEl.textContent = cripto.simbolo;

    const holdingEl = document.getElementById('holdings-actual');
    if(holdingEl) holdingEl.textContent = (holdings[criptoId] || 0).toFixed(6);
    
    const valorTotalEl = document.getElementById('valor-total');
    if(valorTotalEl) valorTotalEl.textContent = formatearDinero((holdings[criptoId] || 0) * datos.precio);
    
    // Inputs
    const inputPrecioCompra = document.getElementById('precio-compra');
    const inputPrecioVenta = document.getElementById('precio-venta');
    if (inputPrecioCompra) inputPrecioCompra.value = datos.precio;
    if (inputPrecioVenta) inputPrecioVenta.value = datos.precio;

    // Botones
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
    
    let costo = cantidad * datosCriptos[id].precio;
    if (costo > saldoUsuario && (costo - saldoUsuario) < 0.01) costo = saldoUsuario;
    if (costo > saldoUsuario) return Swal.fire('Error', 'Saldo insuficiente', 'error');

    saldoUsuario -= costo;
    if (saldoUsuario < 0) saldoUsuario = 0; 
    
    holdings[id] = (holdings[id] || 0) + cantidad;
    
    registrarOperacion('COMPRA', id, datosCriptos[id].precio, cantidad);
    finalizarOperacion(id, 'Compra exitosa');
}

function ejecutarVentaRapida() {
    const id = document.getElementById('selector-cripto').value;
    let cantidad = parseFloat(document.getElementById('cantidad-venta').value);
    
    if (!cantidad || cantidad <= 0) return Swal.fire('Error', 'Cantidad inválida', 'error');

    const misHoldings = holdings[id] || 0;
    if (cantidad > misHoldings && (cantidad - misHoldings) < 0.000001) cantidad = misHoldings;
    if (cantidad > misHoldings) return Swal.fire('Error', 'No tienes suficientes criptos', 'error');

    const ganancia = cantidad * datosCriptos[id].precio;
    saldoUsuario += ganancia;
    holdings[id] -= cantidad;
    if (holdings[id] < 0) holdings[id] = 0;

    registrarOperacion('VENTA', id, datosCriptos[id].precio, cantidad);
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
    historialOperaciones.unshift({
        tipo: tipo, simbolo: cripto.simbolo, precio: precio, cantidad: cantidad,
        total: precio * cantidad, hora: new Date().toLocaleTimeString()
    });
    if (historialOperaciones.length > 50) historialOperaciones.pop();
}

// ============================================
// RENDERIZADO DE HISTORIAL (FILTRADO)
// ============================================
function renderizarHistorialIzquierdo() {
    const contenedor = document.getElementById('historial-panel-izquierdo');
    if (!contenedor) return;

    // 1. Averiguar qué cripto estamos viendo
    const selector = document.getElementById('selector-cripto');
    const criptoIdActual = selector ? selector.value : null;
    
    const objCripto = criptos.find(c => c.id === criptoIdActual);
    const simboloActual = objCripto ? objCripto.simbolo : '';

    // 2. Filtrar la lista
    const operacionesFiltradas = historialOperaciones.filter(op => op.simbolo === simboloActual);

    // 3. Mostrar
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
    cargarDatos();
    
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

    await obtenerPreciosSimples();
    
    if (selector) {
        actualizarVistaSimulador(selector.value);
        actualizarGraficoTrading(selector.value, temporalidadActual);
    }
    
    ['compra', 'venta'].forEach(tipo => {
        const inputCantidad = document.getElementById('cantidad-' + tipo);
        const inputTotal = document.getElementById('total-' + tipo);
        if(!inputCantidad) return;
        
        inputCantidad.addEventListener('input', function() {
            const id = document.getElementById('selector-cripto').value;
            const precio = datosCriptos[id]?.precio || 0;
            let cantidad = parseFloat(this.value);
            if (isNaN(cantidad) || cantidad < 0) cantidad = 0;
            const total = (cantidad * precio);
            inputTotal.value = isNaN(total) || total === 0 ? '' : total.toFixed(2);
        });
        
        inputTotal.addEventListener('input', function() {
            const id = document.getElementById('selector-cripto').value;
            const precio = datosCriptos[id]?.precio || 0;
            let total = parseFloat(this.value);
            if (isNaN(total) || total < 0) total = 0;
            if (precio > 0) inputCantidad.value = (total / precio).toFixed(8);
        });
    });

    setInterval(async () => { await obtenerPreciosSimples(); }, 3000);
});