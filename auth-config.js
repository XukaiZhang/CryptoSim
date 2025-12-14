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
// LÓGICA DE SESIÓN (MODIFICADA PARA UI UNIFICADA)
// ==========================================
let usuarioActual = null;

auth.onAuthStateChanged(async (user) => {
    // Referencias a elementos de la interfaz
    const infoUsuario = document.getElementById('info-usuario');
    const infoInvitado = document.getElementById('info-invitado');
    const imgPerfil = document.getElementById('user-photo');
    const nombreUsuario = document.getElementById('user-name');
    const emailUsuario = document.getElementById('user-email');

    if (user) {
        // --- MODO: USUARIO CONECTADO ---
        usuarioActual = user;
        console.log("Conectado como:", user.displayName);

        // 1. Alternar interfaz (Ocultar invitado, mostrar usuario)
        if(infoInvitado) infoInvitado.style.display = 'none';
        if(infoUsuario) infoUsuario.style.display = 'block';

        // 2. Rellenar datos del perfil
        if(imgPerfil) imgPerfil.src = user.photoURL;
        if(nombreUsuario) nombreUsuario.textContent = user.displayName;
        if(emailUsuario) emailUsuario.textContent = user.email;

        // 3. Cargar datos de la nube
        await cargarDatosNube(user.uid);

    } else {
        // --- MODO: INVITADO (LOGOUT) ---
        usuarioActual = null;
        console.log("Modo invitado");

        // 1. Alternar interfaz (Ocultar usuario, mostrar invitado)
        if(infoUsuario) infoUsuario.style.display = 'none';
        if(infoInvitado) infoInvitado.style.display = 'block';

        // 2. Poner avatar genérico
        // 2. Poner avatar genérico (TU IMAGEN LOCAL)
        if(imgPerfil) imgPerfil.src = "guest-avatar.png";

        // 3. Cargar datos LOCALES (Esto soluciona el problema de que no "reseteaba")
        // Al no haber usuario, script.js leerá localStorage.
        if(typeof cargarDatos === 'function') cargarDatos(); 
        
        // 4. Actualizar visualmente (Importante para que cambie el saldo al instante)
        if(typeof actualizarVisualmente === 'function') actualizarVisualmente();
    }
});

// ==========================================
// ACCIONES DE SESIÓN
// ==========================================
function iniciarSesionGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Error:", error);
        Swal.fire('Error', error.message, 'error');
    });
}

function cerrarSesion() {
    auth.signOut().then(() => {
        sessionStorage.removeItem('welcomeShown');
        // Recargar asegura que se limpien variables de memoria y se lea localStorage limpio
        location.reload(); 
    });
}

// ==========================================
// SINCRONIZACIÓN DE DATOS
// ==========================================
async function guardarEnNube() {
    if (!usuarioActual) return; 
    try {
        await db.collection('usuarios').doc(usuarioActual.uid).set({
            saldo: saldoUsuario,
            holdings: holdings,
            historial: historialOperaciones,
            ultimaActualizacion: new Date()
        });
    } catch (e) { console.error("Error guardando nube:", e); }
}

async function cargarDatosNube(uid) {
    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        const localData = JSON.parse(localStorage.getItem('cryptosim-data') || '{}');
        
        // Comprobamos si hay datos locales relevantes para sugerir sincronización
        // (Solo si la nube está "vacía" o es nueva)
        const tieneProgresoLocal = localData.saldo !== undefined && localData.saldo !== 100000;
        
        if (doc.exists) {
            const data = doc.data();
            const nubeEsDefault = (!data.saldo || data.saldo === 100000) && (!data.holdings || Object.keys(data.holdings).length === 0);

            if (nubeEsDefault && tieneProgresoLocal) {
                // Sincronización inversa (Local -> Nube) la primera vez
                console.log("Subiendo progreso local a cuenta nueva...");
                saldoUsuario = localData.saldo;
                holdings = localData.holdings || {};
                historialOperaciones = localData.historialOperaciones || [];
                await guardarEnNube();
                Swal.fire({ icon: 'info', title: 'Sincronizado', text: 'Tu progreso de invitado se ha guardado en tu cuenta.', timer: 2000, showConfirmButton: false });
            } else {
                // Normal (Nube -> Local)
                saldoUsuario = (data.saldo !== undefined) ? data.saldo : 100000;
                holdings = data.holdings || {};
                historialOperaciones = data.historial || [];
            }
        } else {
            // Usuario nuevo en Firestore
            if (tieneProgresoLocal) {
                saldoUsuario = localData.saldo;
                holdings = localData.holdings || {};
                historialOperaciones = localData.historialOperaciones || [];
            } else {
                saldoUsuario = 100000;
            }
            await guardarEnNube();
        }

        if(typeof actualizarVisualmente === 'function') actualizarVisualmente();

        if (!sessionStorage.getItem('welcomeShown')) {
            Swal.fire({
                icon: 'success',
                title: `Hola, ${usuarioActual.displayName.split(' ')[0]}`,
                toast: true, position: 'top-end', showConfirmButton: false, timer: 2000
            });
            sessionStorage.setItem('welcomeShown', 'true');
        }

    } catch (e) { console.error("Error cargando nube:", e); }
}