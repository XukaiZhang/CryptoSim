// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyB9XeOvfHecSfEq1uCorWFLR7OJsrGwnKA",
  authDomain: "crypto-sim-90fdd.firebaseapp.com",
  projectId: "crypto-sim-90fdd",
  storageBucket: "crypto-sim-90fdd.firebasestorage.app",
  messagingSenderId: "783195911306",
  appId: "1:783195911306:web:a02a14276ef771e195e973",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// LÓGICA DE SESIÓN
// ==========================================
let usuarioActual = null;

auth.onAuthStateChanged(async (user) => {
    // Referencias al DOM (por si estamos en cuenta.html)
    const infoUsuario = document.getElementById('info-usuario');
    const infoInvitado = document.getElementById('info-invitado');
    const imgPerfil = document.getElementById('user-photo');
    const nombreUsuario = document.getElementById('user-name');
    const emailUsuario = document.getElementById('user-email');

    if (user) {
        // --- USUARIO CONECTADO ---
        usuarioActual = user;
        console.log("Conectado:", user.displayName);

        if(infoInvitado) infoInvitado.style.display = 'none';
        if(infoUsuario) infoUsuario.style.display = 'block';

        if(imgPerfil) imgPerfil.src = user.photoURL;
        if(nombreUsuario) nombreUsuario.textContent = user.displayName;
        if(emailUsuario) emailUsuario.textContent = user.email;

        // Cargar desde la nube
        await cargarDatosNube(user.uid);

    } else {
        // --- MODO INVITADO ---
        usuarioActual = null;
        console.log("Modo invitado");

        if(infoUsuario) infoUsuario.style.display = 'none';
        if(infoInvitado) infoInvitado.style.display = 'block';
        if(imgPerfil) imgPerfil.src = "guest-avatar.png"; 

        // IMPORTANTE: Cargar datos locales inmediatamente
        if(typeof cargarDatos === 'function') cargarDatos();
        if(typeof actualizarVisualmente === 'function') actualizarVisualmente();
    }
});

// ==========================================
// ACCIONES (LOGIN / LOGOUT)
// ==========================================
function iniciarSesionGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((e) => Swal.fire('Error', e.message, 'error'));
}

function cerrarSesion() {
    auth.signOut().then(() => {
        // 1. Borrar datos locales del usuario anterior
        localStorage.removeItem('cryptosim-data');
        sessionStorage.removeItem('welcomeShown');
        
        // 2. Forzar recarga completa para limpiar variables en memoria
        window.location.href = 'cuenta.html?logout=true';
    });
}

// ==========================================
// SINCRONIZACIÓN NUBE
// ==========================================
async function guardarEnNube() {
    if (!usuarioActual) return; 
    try {
        // Guardamos las variables globales de script.js
        await db.collection('usuarios').doc(usuarioActual.uid).set({
            saldo: window.saldoUsuario || 100000,
            holdings: window.holdings || {},
            historial: window.historialOperaciones || [],
            ultimaActualizacion: new Date()
        });
    } catch (e) { console.error(e); }
}

async function cargarDatosNube(uid) {
    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        const localData = JSON.parse(localStorage.getItem('cryptosim-data') || '{}');
        const tieneProgresoLocal = localData.saldo !== undefined && localData.saldo !== 100000;
        
        if (doc.exists) {
            const data = doc.data();
            const nubeEsDefault = (!data.saldo || data.saldo === 100000) && (!data.holdings || Object.keys(data.holdings).length === 0);

            if (nubeEsDefault && tieneProgresoLocal) {
                // Subir local a nube si la nube es nueva
                window.saldoUsuario = localData.saldo;
                window.holdings = localData.holdings || {};
                window.historialOperaciones = localData.historialOperaciones || [];
                await guardarEnNube();
            } else {
                // Descargar de nube
                window.saldoUsuario = (data.saldo !== undefined) ? data.saldo : 100000;
                window.holdings = data.holdings || {};
                window.historialOperaciones = data.historial || [];
            }
        } else {
            // Usuario nuevo
            if (tieneProgresoLocal) {
                window.saldoUsuario = localData.saldo;
                window.holdings = localData.holdings || {};
            } else {
                window.saldoUsuario = 100000;
                window.holdings = {};
            }
            await guardarEnNube();
        }

        // Refrescar interfaz
        if(typeof actualizarVisualmente === 'function') actualizarVisualmente();
        
        // Guardar copia local por seguridad
        if(typeof guardarDatos === 'function') guardarDatos();

        if (!sessionStorage.getItem('welcomeShown')) {
            Swal.fire({ icon: 'success', title: `Hola, ${usuarioActual.displayName.split(' ')[0]}`, toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            sessionStorage.setItem('welcomeShown', 'true');
        }
    } catch (e) { console.error(e); }
}