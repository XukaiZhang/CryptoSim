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
// VARIABLES GLOBALES (Públicas)
// ============================================
var saldoUsuario = (typeof saldoUsuario !== 'undefined') ? saldoUsuario : 100000;
var holdings = (typeof holdings !== 'undefined') ? holdings : {};
var datosCriptos = (typeof datosCriptos !== 'undefined') ? datosCriptos : {};
var historialOperaciones = (typeof historialOperaciones !== 'undefined') ? historialOperaciones : [];

// Inicializar holdings si está vacío
if (Object.keys(holdings).length === 0) {
    criptos.forEach(cripto => {
        holdings[cripto.id] = 0;
    });
}

// ============================================
// CARGA Y GUARDADO
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
// FUNCIÓN RESETEAR
// ============================================
function resetearApp() {
    Swal.fire({
        title: '¿Resetear todo?',
        text: "Se borrarán los datos de la nube y locales.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0ecb81',
        cancelButtonColor: '#f6465d',
        confirmButtonText: 'Sí, borrar',
        background: '#181a20', color: '#eaecef'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Borrando...', didOpen: () => Swal.showLoading(), background: '#181a20', color: '#eaecef' });
            localStorage.removeItem('cryptosim-data');
            if (typeof db !== 'undefined' && typeof usuarioActual !== 'undefined' && usuarioActual) {
                try {
                    await db.collection('usuarios').doc(usuarioActual.uid).set({
                        saldo: 100000, holdings: {}, historial: [], ultimaActualizacion: new Date()
                    });
                } catch (e) { console.error(e); }
            }
            setTimeout(() => location.reload(), 1000);
        }
    });
}

// ============================================
// UTILIDADES Y UI
// ============================================
function formatearDinero(cantidad) {
    const numero = parseFloat(cantidad);
    return '$' + numero.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function formatearCripto(cantidad) { return cantidad.toFixed(6); }

function calcularPatrimonioTotal() {
    let valorInvertido = 0;
    criptos.forEach(c => {
        const cantidad = holdings[c.id] || 0;
        const precio = datosCriptos[c.id] ? datosCriptos[c.id].precio : 0;
        valorInvertido += cantidad * precio;
    });
    return (parseFloat(saldoUsuario) || 0) + valorInvertido;
}

function actualizarPatrimonioTotal() {
    const patrimonio = calcularPatrimonioTotal();
    const carteraEl = document.getElementById('cartera');
    if (carteraEl) carteraEl.textContent = formatearDinero(patrimonio);
    const saldoEl = document.getElementById('saldo-disponible-texto');
    if (saldoEl) saldoEl.textContent = formatearDinero(parseFloat(saldoUsuario) || 0);
}

// ============================================
// TABLA Y PRECIOS
// ============================================
async function obtenerPreciosSimples() {
    try {
        const ids = criptos.map(c => c.id).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
        const data = await res.json();

        criptos.forEach(cripto => {
            if (data[cripto.id]) {
                datosCriptos[cripto.id] = {
                    precio: data[cripto.id].usd,
                    cambio24h: data[cripto.id].usd_24h_change || 0
                };
            }
        });
        
        guardarDatos();
        actualizarTabla();
        actualizarPatrimonioTotal();
    } catch (error) { console.warn(error); }
}

function actualizarTabla() {
    const tbody = document.getElementById('tabla-criptomonedas');
    if (!tbody || Object.keys(datosCriptos).length === 0) return;

    let html = '';
    criptos.forEach(cripto => {
        const datos = datosCriptos[cripto.id];
        if (!datos) return;
        
        const cantidad = holdings[cripto.id] || 0;
        const cambioClase = datos.cambio24h >= 0 ? 'cambio-positivo' : 'cambio-negativo';
        
        html += `<tr>
            <td><div class="cripto-nombre"><div class="cripto-icono">${cripto.icono}</div><div><div>${cripto.nombre}</div><div class="cripto-simbolo">${cripto.simbolo}</div></div></div></td>
            <td><span class="precio-actual">${formatearDinero(datos.precio)}</span></td>
            <td><span class="${cambioClase}">${datos.cambio24h >= 0 ? '+' : ''}${datos.cambio24h.toFixed(2)}%</span></td>
            <td><div class="holdings-valor">${formatearDinero(cantidad * datos.precio)}</div><div class="holdings-cantidad">${formatearCripto(cantidad)} ${cripto.simbolo}</div></td>
            <td><button class="btn btn-action btn-ver-grafico" onclick="verGrafico('${cripto.id}')"><i class="fas fa-chart-line"></i> Ver</button></td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function verGrafico(id) {
    sessionStorage.setItem('cryptosim-selected', id);
    window.location.href = 'simulador.html';
}

window.addEventListener('load', async function() {
    cargarDatos();
    actualizarPatrimonioTotal();
    if (Object.keys(datosCriptos).length > 0) actualizarTabla();
    await obtenerPreciosSimples();
    setInterval(async () => { await obtenerPreciosSimples(); }, 5000);
});