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
let saldoUsuario = 100000;
let holdings = {};
let datosCriptos = {};

// Inicializar holdings a 0
criptos.forEach(cripto => {
    holdings[cripto.id] = 0;
});

// ============================================
// CARGA DE DATOS (IGUAL QUE EN EL SIMULADOR)
// ============================================
function cargarDatos() {
    // Intentamos leer la memoria del navegador
    const datosRaw = localStorage.getItem('cryptosim-data');
    
    if (datosRaw) {
        try {
            const datos = JSON.parse(datosRaw);
            
            // Cargar saldo
            if (datos.saldo !== undefined) {
                saldoUsuario = datos.saldo;
            }

            // Cargar holdings (fusionando con ceros iniciales)
            if (datos.holdings) {
                // Mantenemos la estructura base y sobreescribimos con lo guardado
                holdings = { ...holdings, ...datos.holdings };
            }
            
            console.log("Datos cargados en Index:", holdings);
        } catch (e) {
            console.error("Error al cargar datos en index", e);
        }
    }
}

// ============================================
// CÁLCULOS Y UI
// ============================================
function formatearDinero(cantidad) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: 2
    }).format(cantidad);
}

function formatearCripto(cantidad) {
    return parseFloat(cantidad).toFixed(6);
}

function calcularPatrimonioTotal() {
    let valorCriptos = 0;
    
    // Sumar el valor de todas las criptos que tienes
    criptos.forEach(c => {
        const cantidad = holdings[c.id] || 0;
        // Usamos el precio actual si ya cargó, sino 0
        const precio = (datosCriptos[c.id]) ? datosCriptos[c.id].precio : 0;
        valorCriptos += cantidad * precio;
    });

    return saldoUsuario + valorCriptos;
}

function actualizarInterfaz() {
    const patrimonioTotal = calcularPatrimonioTotal();
    
    // 1. Actualizar el Patrimonio Total (Grande)
    const carteraEl = document.getElementById('cartera');
    if (carteraEl) {
        carteraEl.textContent = formatearDinero(patrimonioTotal);
    }

    // 2. Actualizar el Saldo Disponible (Texto pequeño)
    const saldoTextoEl = document.getElementById('saldo-disponible-texto');
    if (saldoTextoEl) {
        saldoTextoEl.textContent = formatearDinero(saldoUsuario);
    }
}

// ============================================
// ACTUALIZAR TABLA
// ============================================
function actualizarTabla() {
    const tbody = document.getElementById('tabla-criptomonedas');
    if (!tbody) return;

    // Si aún no hay precios, mostramos carga
    if (Object.keys(datosCriptos).length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="crypto-loader"><i class="fas fa-spinner"></i><p>Cargando precios...</p></div></td></tr>`;
        return;
    }

    let html = '';

    criptos.forEach(cripto => {
        const datos = datosCriptos[cripto.id];
        
        if (datos) {
            const cantidad = holdings[cripto.id] || 0;
            const valorEnDolares = cantidad * datos.precio;
            
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
                    <td><span class="precio-actual">${formatearDinero(datos.precio)}</span></td>
                    <td><span class="${cambioClase}">${cambioSigno}${datos.cambio24h.toFixed(2)}%</span></td>
                    <td>
                        <div class="holdings-valor">${formatearDinero(valorEnDolares)}</div>
                        <div class="holdings-cantidad">${formatearCripto(cantidad)} ${cripto.simbolo}</div>
                    </td>
                    <td>
                        <button class="btn btn-action btn-ver-grafico" onclick="verGrafico('${cripto.id}')">
                            <i class="fas fa-chart-line"></i> Operar
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    tbody.innerHTML = html;
}

// ============================================
// CONEXIÓN API
// ============================================
async function obtenerPreciosSimples() {
    try {
        const ids = criptos.map(c => c.id).join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        const res = await fetch(url);
        const data = await res.json();

        criptos.forEach(cripto => {
            if (data[cripto.id]) {
                datosCriptos[cripto.id] = {
                    precio: data[cripto.id].usd,
                    cambio24h: data[cripto.id].usd_24h_change || 0
                };
            }
        });
        
        // Una vez tenemos precios, actualizamos todo
        actualizarInterfaz();
        actualizarTabla();

    } catch (error) {
        console.warn('Error API:', error);
    }
}

// ============================================
// NAVEGACIÓN
// ============================================
function verGrafico(criptoId) {
    sessionStorage.setItem('cryptosim-selected', criptoId);
    window.location.href = 'simulador.html';
}

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('load', async function() {
    // 1. Cargar lo que tengamos guardado
    cargarDatos();
    
    // 2. Pintar interfaz inicial (con precios antiguos o vacíos)
    actualizarInterfaz();
    
    // 3. Obtener precios frescos
    await obtenerPreciosSimples();
    
    // 4. Actualizar cada 5 segundos
    setInterval(async () => {
        await obtenerPreciosSimples();
    }, 5000);
});