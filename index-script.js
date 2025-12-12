// ============================================
// CONFIGURACIÓN DE CRIPTOMONEDAS
// ============================================
const criptos = [
    { id: "bitcoin", nombre: "Bitcoin", simbolo: "BTC", icono: "₿" },
    { id: "ethereum", nombre: "Ethereum", simbolo: "ETH", icono: "Ξ" },
    { id: "binancecoin", nombre: "BNB", simbolo: "BNB", icono: "🔶" },
    { id: "solana", nombre: "Solana", simbolo: "SOL", icono: "◎" },
    { id: "dogecoin", nombre: "Dogecoin", simbolo: "DOGE", icono: "Ð" }
];

// ============================================
// VARIABLES GLOBALES
// ============================================
let saldoUsuario = 10000;
let holdings = {};
let datosCriptos = {};
let historialOperaciones = [];

// Inicializar holdings a 0
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

function formatearCripto(cantidad) {
    return cantidad.toFixed(6);
}

// ============================================
// OBTENER PRECIOS DE COINGECKO
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
                    cambio24h: data[cripto.id].usd_24h_change || 0
                };
            }
        });
        
        // Guardar los precios actualizados
        guardarDatos();
        
        // Actualizar la UI
        actualizarTabla();
        actualizarPatrimonioTotal();

    } catch (error) {
        console.warn('Error al obtener precios:', error);
        // Mostrar mensaje en la tabla si hay error
        const tbody = document.getElementById('tabla-criptomonedas');
        if (tbody && Object.keys(datosCriptos).length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="crypto-loader">
                            <i class="fas fa-exclamation-triangle text-warning"></i>
                            <p class="mt-2 text-warning">Error al conectar con la API. Reintentando...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

// ============================================
// CALCULAR PATRIMONIO TOTAL
// ============================================
function calcularPatrimonioTotal() {
    let valorInvertido = 0;
    
    criptos.forEach(c => {
        const cantidad = holdings[c.id] || 0;
        const precio = datosCriptos[c.id] ? datosCriptos[c.id].precio : 0;
        valorInvertido += cantidad * precio;
    });

    return saldoUsuario + valorInvertido;
}

function actualizarPatrimonioTotal() {
    const patrimonioTotal = calcularPatrimonioTotal();
    const carteraEl = document.getElementById('cartera');
    
    if (carteraEl) {
        const valorAnterior = carteraEl.textContent;
        const nuevoValor = formatearDinero(patrimonioTotal);
        
        if (valorAnterior !== nuevoValor) {
            carteraEl.textContent = nuevoValor;
            carteraEl.classList.add('updating');
            setTimeout(() => carteraEl.classList.remove('updating'), 500);
        } else {
            carteraEl.textContent = nuevoValor;
        }
    }
}

// ============================================
// ACTUALIZAR TABLA DE CRIPTOMONEDAS
// ============================================
function actualizarTabla() {
    const tbody = document.getElementById('tabla-criptomonedas');
    if (!tbody) return;

    // Verificar si tenemos datos
    if (Object.keys(datosCriptos).length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="crypto-loader">
                        <i class="fas fa-spinner"></i>
                        <p class="mt-2">Cargando datos del mercado...</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';

    criptos.forEach(cripto => {
        const datos = datosCriptos[cripto.id];
        
        // Si no hay datos de esta cripto específica, mostrar placeholder
        if (!datos) {
            html += `
                <tr>
                    <td>
                        <div class="cripto-nombre">
                            <div class="cripto-icono">${cripto.icono}</div>
                            <div>
                                <div>${cripto.nombre}</div>
                                <div class="cripto-simbolo">${cripto.simbolo}</div>
                            </div>
                        </div>
                    </td>
                    <td colspan="4" class="text-muted">Cargando...</td>
                </tr>
            `;
            return;
        }

        const cantidadHolding = holdings[cripto.id] || 0;
        const valorHolding = cantidadHolding * datos.precio;
        
        const cambioClase = datos.cambio24h >= 0 ? 'cambio-positivo' : 'cambio-negativo';
        const cambioSigno = datos.cambio24h >= 0 ? '+' : '';

        html += `
            <tr>
                <td>
                    <div class="cripto-nombre">
                        <div class="cripto-icono">${cripto.icono}</div>
                        <div>
                            <div>${cripto.nombre}</div>
                            <div class="cripto-simbolo">${cripto.simbolo}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="precio-actual">${formatearDinero(datos.precio)}</span>
                </td>
                <td>
                    <span class="${cambioClase}">
                        ${cambioSigno}${datos.cambio24h.toFixed(2)}%
                    </span>
                </td>
                <td>
                    <div class="holdings-valor">${formatearDinero(valorHolding)}</div>
                    <div class="holdings-cantidad">${formatearCripto(cantidadHolding)} ${cripto.simbolo}</div>
                </td>
                <td>
                    <button class="btn btn-action btn-ver-grafico" onclick="verGrafico('${cripto.id}')">
                        <i class="fas fa-chart-line"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ============================================
// NAVEGACIÓN
// ============================================
function verGrafico(criptoId) {
    // Guardar la selección para que el simulador la muestre
    sessionStorage.setItem('cryptosim-selected', criptoId);
    window.location.href = 'simulador.html';
}

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('load', async function() {
    console.log('🚀 Iniciando CryptoSim Index...');
    
    // 1. Cargar datos guardados del localStorage
    cargarDatos();
    console.log('📊 Datos cargados - Saldo:', saldoUsuario, 'Holdings:', holdings);
    
    // 2. Actualizar patrimonio inicial (con datos guardados)
    actualizarPatrimonioTotal();
    
    // 3. Si tenemos datos guardados de precios, mostrar tabla inmediatamente
    if (Object.keys(datosCriptos).length > 0) {
        console.log('💾 Usando precios guardados del cache');
        actualizarTabla();
    }
    
    // 4. Obtener precios actuales de la API
    console.log('🌐 Obteniendo precios en tiempo real...');
    await obtenerPreciosSimples();
    
    // 5. Auto-actualización cada 5 segundos (más frecuente para mejor sincronización)
    setInterval(async () => {
        console.log('🔄 Actualizando precios...');
        await obtenerPreciosSimples();
    }, 5000);
    
    console.log('✅ CryptoSim Index iniciado correctamente');
});