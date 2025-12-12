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
// VARIABLES GLOBALES
// ============================================
let saldoUsuario = 10000;
let holdings = {};
let datosCriptos = {};
let historialOperaciones = [];
let chartSimuladorInstance = null;
let temporalidadActual = '30m';

// Inicializar holdings a 0 si es la primera vez
criptos.forEach(cripto => {
    holdings[cripto.id] = 0;
});

// ============================================
// CARGA Y GUARDADO DE DATOS (LOCALSTORAGE)
// ============================================
function guardarDatos() {
    localStorage.setItem('cryptosim-data', JSON.stringify({
        saldo: saldoUsuario,
        holdings: holdings,
        datosCriptos: datosCriptos,
        historialOperaciones: historialOperaciones
    }));
    actualizarSaldoTotalCuenta();
}

function cargarDatos() {
    const datos = JSON.parse(localStorage.getItem('cryptosim-data') || '{}');
    if (datos.saldo !== undefined) {
        saldoUsuario = datos.saldo;
        holdings = datos.holdings || holdings;
        datosCriptos = datos.datosCriptos || {};
        historialOperaciones = datos.historialOperaciones || [];
    }
}

function resetearApp() {
    Swal.fire({
        title: '¿Estás seguro?',
        text: "Se borrarán todos los datos y tu cuenta volverá a $10,000",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0ecb81',
        cancelButtonColor: '#f6465d',
        confirmButtonText: 'Sí, resetear',
        cancelButtonText: 'Cancelar',
        background: '#181a20',
        color: '#eaecef'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('cryptosim-data');
            location.reload();
        }
    });
}

// ============================================
// UTILIDADES
// ============================================
function formatearDinero(cantidad) {
    return '$' + cantidad.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function mostrarCarga(mostrar = true) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = mostrar ? 'flex' : 'none';
}

// ============================================
// OBTENER NOMBRE DE TEMPORALIDAD
// ============================================
function obtenerNombreTemporalidad(intervalo) {
    const nombres = {
        '30m': '30 minutos',
        '1h': '1 hora',
        '4h': '4 horas',
        '1d': '1 día',
        '1w': '1 semana'
    };
    return nombres[intervalo] || intervalo;
}

// ============================================
// LÓGICA DE PRECIOS (CoinGecko para Panel)
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
        
        const selector = document.getElementById('selector-cripto');
        if (selector) {
            actualizarVistaSimulador(selector.value);
            actualizarSaldoTotalCuenta();
        }

    } catch (error) {
        console.warn('Esperando conexión API...', error);
    }
}

// ============================================
// LÓGICA DE GRÁFICA (Binance API para Velas)
// ============================================
async function obtenerDatosBinance(criptoId, intervalo) {
    const cripto = criptos.find(c => c.id === criptoId);
    if (!cripto || !cripto.binanceSymbol) return [];

    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${cripto.binanceSymbol}&interval=${intervalo}&limit=50`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        return data.map(d => ({
            x: new Date(d[0]),
            y: [parseFloat(d[1]), parseFloat(d[2]), parseFloat(d[3]), parseFloat(d[4])]
        }));
    } catch (e) {
        console.error("Error Binance API:", e);
        return [];
    }
}

async function actualizarGraficoTrading(criptoId, intervalo) {
    const contenedor = document.getElementById('chartTrading');
    
    if (!contenedor) return;
    if (typeof ApexCharts === 'undefined') {
        contenedor.innerHTML = '<p class="text-danger text-center mt-5">Error: Librería ApexCharts no cargada.</p>';
        return;
    }

    const seriesData = await obtenerDatosBinance(criptoId, intervalo);
    if (!seriesData.length) return;

    // ============================================================
    // CÁLCULO DE PORCENTAJE SEGÚN TEMPORALIDAD SELECCIONADA
    // ============================================================
    
    // Precio inicial = Open de la primera vela
    const precioInicial = seriesData[0].y[0]; 
    
    // Precio final = Close de la última vela (precio actual)
    const precioFinal = seriesData[seriesData.length - 1].y[3];
    
    // Calcular porcentaje de cambio
    const porcentajeCambio = ((precioFinal - precioInicial) / precioInicial) * 100;

    // Actualizar el header con el porcentaje correcto
    const cambioEl = document.getElementById('cambio-header');
    if (cambioEl) {
        const signo = porcentajeCambio >= 0 ? '+' : '';
        cambioEl.textContent = `${signo}${porcentajeCambio.toFixed(2)}%`;
        
        // Color verde o rojo según el cambio
        cambioEl.className = 'cambio-header ' + (porcentajeCambio >= 0 ? 'cambio-positivo' : 'cambio-negativo');
    }
    
    // Actualizar precio en el header
    const precioHeader = document.getElementById('precio-header');
    if(precioHeader) precioHeader.textContent = formatearDinero(precioFinal);

    // ============================================================
    // RENDERIZAR GRÁFICA
    // ============================================================

    // Destruir gráfica anterior si existe
    if (chartSimuladorInstance) {
        chartSimuladorInstance.destroy();
    }

    const options = {
        series: [{
            name: 'Precio',
            data: seriesData
        }],
        chart: {
            type: 'candlestick',
            height: '80%',
            background: 'transparent',
            toolbar: { show: false },
            animations: { enabled: false }
        },
        theme: { mode: 'dark' },
        plotOptions: {
            candlestick: {
                colors: {
                    upward: '#0ecb81',
                    downward: '#f6465d'
                },
                wick: { useFillColor: true }
            }
        },
        xaxis: {
            type: 'datetime',
            tooltip: { enabled: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: '#848e9c' } }
        },
        yaxis: {
            tooltip: { enabled: true },
            labels: {
                style: { colors: '#848e9c' },
                formatter: (val) => "$" + val.toFixed(2)
            }
        },
        grid: {
            borderColor: '#2b3139',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } }
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            custom: function({series, seriesIndex, dataPointIndex, w}) {
                const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
                const date = new Date(data.x);
                const fechaStr = date.toLocaleDateString() + ' ' + 
                                 date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                return `
                    <div style="padding: 8px 12px; background: #181a20; border: 1px solid #2b3139; color: #eaecef; font-family: sans-serif; font-size: 12px; text-align: center;">
                        📅 ${fechaStr}
                    </div>
                `;
            }
        }
    };

    chartSimuladorInstance = new ApexCharts(contenedor, options);
    chartSimuladorInstance.render();
}

function cambiarTemporalidadBinance(intervalo) {
    temporalidadActual = intervalo;
    
    document.querySelectorAll('.btn-timeframe').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const criptoId = document.getElementById('selector-cripto').value;
    actualizarGraficoTrading(criptoId, intervalo);
}

// ============================================
// INTERFAZ DE USUARIO (Simulador)
// ============================================
function actualizarSaldoTotalCuenta() {
    let valorInvertido = 0;
    
    criptos.forEach(c => {
        const cantidad = holdings[c.id] || 0;
        const precio = datosCriptos[c.id] ? datosCriptos[c.id].precio : 0;
        valorInvertido += cantidad * precio;
    });

    const patrimonioTotal = saldoUsuario + valorInvertido;

    const elTotal = document.getElementById('balance-total-cuenta');
    if (elTotal) elTotal.textContent = formatearDinero(patrimonioTotal);
}

async function actualizarVistaSimulador(criptoId) {
    const cripto = criptos.find(c => c.id === criptoId);
    const datos = datosCriptos[criptoId];
    
    if (!cripto || !datos) return;

    document.getElementById('precio-header').textContent = formatearDinero(datos.precio);
    
    // Nota: El porcentaje del header se actualiza en actualizarGraficoTrading()
    // según la temporalidad seleccionada
    
    document.getElementById('saldo-disponible').textContent = formatearDinero(saldoUsuario);
    document.getElementById('holdings-actual').textContent = holdings[criptoId].toFixed(6);
    document.getElementById('simbolo-holding').textContent = cripto.simbolo;

    const valorHoldings = holdings[criptoId] * datos.precio;
    document.getElementById('valor-total').textContent = formatearDinero(valorHoldings);
    
    const estimadoEl = document.getElementById('valor-venta-estimado');
    if(estimadoEl) estimadoEl.textContent = formatearDinero(valorHoldings);

    actualizarSaldoTotalCuenta();

    document.getElementById('precio-compra').value = datos.precio;
    document.getElementById('precio-venta').value = datos.precio;
    document.getElementById('simbolo-compra').textContent = cripto.simbolo;
    document.getElementById('simbolo-venta').textContent = cripto.simbolo;

    renderizarHistorialIzquierdo();
}

// ============================================
// LISTENERS INTELIGENTES
// ============================================
['compra', 'venta'].forEach(tipo => {
    const inputCantidad = document.getElementById('cantidad-' + tipo);
    const inputTotal = document.getElementById('total-' + tipo);

    inputCantidad?.addEventListener('input', function() {
        const id = document.getElementById('selector-cripto').value;
        const precio = datosCriptos[id]?.precio || 0;
        
        if(this.value < 0) this.value = 0;

        const total = (parseFloat(this.value) * precio);
        inputTotal.value = isNaN(total) ? '' : total.toFixed(2);
    });

    inputTotal?.addEventListener('input', function() {
        const id = document.getElementById('selector-cripto').value;
        const precio = datosCriptos[id]?.precio || 0;

        if(this.value < 0) this.value = 0;

        if (precio > 0) {
            const cantidad = (parseFloat(this.value) / precio);
            inputCantidad.value = isNaN(cantidad) ? '' : cantidad.toFixed(8);
        }
    });
});

// ============================================
// OPERACIONES DE TRADING
// ============================================
function ejecutarCompraRapida() {
    const id = document.getElementById('selector-cripto').value;
    const cantidad = parseFloat(document.getElementById('cantidad-compra').value);
    
    if (!cantidad || cantidad <= 0) return Swal.fire('Error', 'Cantidad inválida', 'error');
    const costo = cantidad * datosCriptos[id].precio;
    
    if (costo > saldoUsuario) return Swal.fire('Error', 'Saldo insuficiente', 'error');

    saldoUsuario -= costo;
    holdings[id] += cantidad;
    
    registrarOperacion('COMPRA', id, datosCriptos[id].precio, cantidad);
    finalizarOperacion(id, 'Compra exitosa');
}

function ejecutarVentaRapida() {
    const id = document.getElementById('selector-cripto').value;
    const cantidad = parseFloat(document.getElementById('cantidad-venta').value);
    
    if (!cantidad || cantidad <= 0) return Swal.fire('Error', 'Cantidad inválida', 'error');
    if (cantidad > holdings[id]) return Swal.fire('Error', 'No tienes suficientes criptos', 'error');

    const ganancia = cantidad * datosCriptos[id].precio;
    saldoUsuario += ganancia;
    holdings[id] -= cantidad;

    registrarOperacion('VENTA', id, datosCriptos[id].precio, cantidad);
    finalizarOperacion(id, 'Venta exitosa');
}

function finalizarOperacion(id, mensaje) {
    Swal.fire({
        icon: 'success', title: mensaje, 
        toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
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
        tipo: tipo,
        simbolo: cripto.simbolo,
        precio: precio,
        cantidad: cantidad,
        total: precio * cantidad,
        hora: new Date().toLocaleTimeString()
    });
    if (historialOperaciones.length > 20) historialOperaciones.pop();
}

function renderizarHistorialIzquierdo() {
    const contenedor = document.getElementById('historial-panel-izquierdo');
    if (!contenedor) return;

    if (historialOperaciones.length === 0) {
        contenedor.innerHTML = '<p class="text-muted text-center small mt-4">Sin operaciones</p>';
        return;
    }

    let html = '';
    historialOperaciones.forEach(op => {
        const colorClass = op.tipo === 'COMPRA' ? 'text-success' : 'text-danger';
        html += `
            <div class="orderbook-row" style="padding: 8px 0; border-bottom: 1px solid #2b3139;">
                <span class="${colorClass}" style="font-weight:bold;">${op.tipo}</span>
                <span>${op.precio.toFixed(2)}</span>
                <span>${op.cantidad.toFixed(4)}</span>
            </div>
        `;
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

        // Verificar si hay una cripto preseleccionada desde index
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

    setInterval(async () => {
        await obtenerPreciosSimples();
    }, 3000);
});