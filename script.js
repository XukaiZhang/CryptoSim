// Lista de criptos soportadas
const criptos = [
    { id: "bitcoin", nombre: "Bitcoin (BTC)" },
    { id: "ethereum", nombre: "Ethereum (ETH)" },
    { id: "binancecoin", nombre: "BNB" },
    { id: "solana", nombre: "Solana" },
    { id: "dogecoin", nombre: "Dogecoin" }
];

// Obtener precio actual desde CoinGecko (API gratis)
async function obtenerPrecio(criptoId) {
    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${criptoId}&vs_currencies=usd&precision=2`;

        const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const data = await res.json();
        return data[criptoId].usd;

    } catch (error) {
        console.error("Error obteniendo precio:", error);
        return null;
    }
}

// Actualiza el panel de análisis
async function actualizarVistaSimulador(indice) {
    const cripto = criptos[indice];

    document.getElementById("nombre-cripto-actual").textContent = cripto.nombre;

    const precio = await obtenerPrecio(cripto.id);

    if (precio) {
        document.getElementById("precio-actual").textContent =
            precio.toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " €";
    }
}

// Actualizar el precio cada 10 segundos
setInterval(() => {
    const indice = parseInt(document.getElementById("selector-cripto").value);
    actualizarVistaSimulador(indice);
}, 3000);
