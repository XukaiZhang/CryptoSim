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

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// LÓGICA DE AUTENTICACIÓN
// ==========================================
let usuarioActual = null;

// Escuchar cambios de sesión (Login/Logout)
auth.onAuthStateChanged(async (user) => {
    const loginView = document.getElementById('login-view');
    const profileView = document.getElementById('profile-view');
    
    if (user) {
        // --- USUARIO LOGUEADO ---
        usuarioActual = user;
        console.log("Usuario conectado:", user.displayName);

        if (loginView) loginView.style.display = 'none';
        if (profileView) profileView.style.display = 'flex';

        // Actualizar UI de perfil
        const img = document.getElementById('user-photo');
        const name = document.getElementById('user-name');
        const email = document.getElementById('user-email');
        
        if(img) img.src = user.photoURL;
        if(name) name.textContent = user.displayName;
        if(email) email.textContent = user.email;

        // CARGAR DATOS (Priorizando progreso local si la nube es nueva)
        await cargarDatosNube(user.uid);

    } else {
        // --- USUARIO DESCONECTADO ---
        usuarioActual = null;
        console.log("Sin sesión");

        if (loginView) loginView.style.display = 'block';
        if (profileView) profileView.style.display = 'none';
        
        // Si no hay usuario, usamos localStorage
        if(typeof cargarDatos === 'function') cargarDatos(); 
        if(typeof actualizarVisualmente === 'function') actualizarVisualmente();
    }
});

function iniciarSesionGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch((error) => {
            console.error("Error login:", error);
            Swal.fire('Error', error.message, 'error');
        });
}

function cerrarSesion() {
    auth.signOut().then(() => {
        sessionStorage.removeItem('welcomeShown');
        location.reload();
    });
}

// ==========================================
// FUNCIONES DE BASE DE DATOS (CLOUD)
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
        console.log("Datos guardados en la nube");
    } catch (e) {
        console.error("Error guardando en nube:", e);
    }
}

async function cargarDatosNube(uid) {
    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        
        // LEER DATOS LOCALES PARA COMPARAR
        const localData = JSON.parse(localStorage.getItem('cryptosim-data') || '{}');
        const localSaldo = localData.saldo !== undefined ? localData.saldo : 100000;
        
        // Determinar si hay progreso local relevante (si el saldo no es el inicial o hay holdings)
        const tieneProgresoLocal = localSaldo !== 100000 || 
                                   (localData.holdings && Object.values(localData.holdings).some(h => h > 0));

        if (doc.exists) {
            const data = doc.data();
            
            // Determinar si la cuenta en la nube es "nueva" o por defecto (tiene 100k y sin holdings)
            const nubeEsDefault = (!data.saldo || data.saldo === 100000) && 
                                  (!data.holdings || Object.values(data.holdings).every(h => h === 0));

            // === LÓGICA DE SINCRONIZACIÓN INTELIGENTE ===
            // Si la nube está vacía (default) PERO localmente has jugado (tienes progreso),
            // damos prioridad a lo Local y lo subimos a la nube.
            if (nubeEsDefault && tieneProgresoLocal) {
                console.log("⚡ Sincronizando progreso local a la nube...");
                saldoUsuario = localData.saldo;
                holdings = localData.holdings || {};
                historialOperaciones = localData.historialOperaciones || [];
                
                // Guardar inmediatamente en la nube para el futuro
                await guardarEnNube();
                
                Swal.fire({
                    icon: 'info',
                    title: 'Sincronización',
                    text: 'Hemos subido tu progreso local a tu cuenta.',
                    timer: 2000, showConfirmButton: false
                });

            } else {
                // CASO NORMAL: La nube manda
                // (O ya tenías datos en la nube, o no tenías nada en local tampoco)
                
                if (data.saldo === undefined || data.saldo === null || data.saldo < 1) {
                    saldoUsuario = 100000;
                    guardarEnNube(); 
                } else {
                    saldoUsuario = data.saldo;
                }
                
                holdings = data.holdings || {};
                historialOperaciones = data.historial || [];
            }

        } else {
            // USUARIO NUEVO EN LA NUBE (Documento no existe)
            // Si tiene datos locales, los usamos. Si no, empezamos de cero.
            if (tieneProgresoLocal) {
                saldoUsuario = localData.saldo;
                holdings = localData.holdings || {};
                historialOperaciones = localData.historialOperaciones || [];
                console.log("Creando usuario nube con datos locales");
            } else {
                saldoUsuario = 100000;
                console.log("Creando usuario nube nuevo (100k)");
            }
            await guardarEnNube();
        }

        // Actualizar interfaz
        if(typeof actualizarSaldoTotalCuenta === 'function') actualizarSaldoTotalCuenta();
        if(typeof actualizarVisualmente === 'function') actualizarVisualmente();

        // Saludo
        if (!sessionStorage.getItem('welcomeShown')) {
            Swal.fire({
                icon: 'success',
                title: `Hola, ${usuarioActual.displayName.split(' ')[0]}`,
                toast: true, position: 'top-end', showConfirmButton: false, timer: 2000
            });
            sessionStorage.setItem('welcomeShown', 'true');
        }

    } catch (e) {
        console.error("Error cargando de nube:", e);
    }
}