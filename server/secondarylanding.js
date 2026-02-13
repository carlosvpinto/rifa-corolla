// landing.js - Funciones para la landing page

document.addEventListener('DOMContentLoaded', function() {
    setupFormValidation();
    setupInputMasking();
});

function setupFormValidation() {
    const form = document.getElementById('saas-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        await submitPurchase();
    });
}

function setupInputMasking() {
    // Phone number masking
    const phoneInput = document.getElementById('buyer-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            if (value.length > 0) {
                if (value.length <= 4) {
                    value = value;
                } else if (value.length <= 7) {
                    value = value.slice(0, 4) + '-' + value.slice(4);
                } else {
                    value = value.slice(0, 4) + '-' + value.slice(4, 7) + '-' + value.slice(7, 11);
                }
            }
            
            e.target.value = value;
        });
    }
    
    // CI masking
    const ciInput = document.getElementById('buyer-ci');
    if (ciInput) {
        ciInput.addEventListener('input', function(e) {
            let value = e.target.value.toUpperCase();
            
            // Auto-add V- if not present
            if (value.length === 1 && /[VEJ]/.test(value)) {
                value = value + '-';
            }
            
            e.target.value = value;
        });
    }
    
    // Payment reference masking
    const refInput = document.getElementById('payment-ref');
    if (refInput) {
        refInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        });
    }
}

function validateForm() {
    const fields = [
        { id: 'buyer-name', name: 'nombre' },
        { id: 'buyer-ci', name: 'cédula' },
        { id: 'buyer-phone', name: 'teléfono' },
        { id: 'buyer-email', name: 'correo electrónico' },
        { id: 'payment-date', name: 'fecha de pago' },
        { id: 'raffle-name', name: 'nombre de la rifa' },
        { id: 'payment-ref', name: 'referencia de pago' }
    ];
    
    for (const field of fields) {
        const element = document.getElementById(field.id);
        if (!element || !element.value.trim()) {
            showToast('Error de validación', `El campo "${field.name}" es requerido`, 'error');
            element?.focus();
            return false;
        }
    }
    
    // Email validation
    const email = document.getElementById('buyer-email').value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Error de validación', 'Por favor ingresa un correo electrónico válido', 'error');
        document.getElementById('buyer-email').focus();
        return false;
    }
    
    // Phone validation (at least 10 digits)
    const phone = document.getElementById('buyer-phone').value.replace(/\D/g, '');
    if (phone.length < 10) {
        showToast('Error de validación', 'El teléfono debe tener al menos 10 dígitos', 'error');
        document.getElementById('buyer-phone').focus();
        return false;
    }
    
    // Payment reference validation (exactly 6 digits)
    const paymentRef = document.getElementById('payment-ref').value;
    if (paymentRef.length !== 6) {
        showToast('Error de validación', 'La referencia de pago debe tener exactamente 6 dígitos', 'error');
        document.getElementById('payment-ref').focus();
        return false;
    }
    
    return true;
}

async function submitPurchase() {
    const submitBtn = document.querySelector('#saas-form button[type="submit"]');
    const submitText = document.getElementById('submit-text');
    const submitIcon = document.getElementById('submit-icon');
    
    // Change button state
    if (submitBtn && submitText && submitIcon) {
        submitBtn.disabled = true;
        submitText.textContent = 'Verificando pago...';
        submitIcon.textContent = 'hourglass_empty';
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
    }
    
    showLoading('Verificando tu pago...');
    
    try {
        const formData = {
            buyerData: {
                name: document.getElementById('buyer-name').value.trim(),
                ci: document.getElementById('buyer-ci').value.trim(),
                phone: document.getElementById('buyer-phone').value.trim(),
                email: document.getElementById('buyer-email').value.trim(),
            },
            raffleName: document.getElementById('raffle-name').value.trim(),
            paymentRef: document.getElementById('payment-ref').value.trim(),
            amount: 50,
            paymentDate: document.getElementById('payment-date').value
        };
        
        const response = await fetch('/api/saas/buy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('¡Éxito!', 'Licencia activada correctamente', 'success');
            
            // Reset form
            document.getElementById('saas-form').reset();
            closePurchaseModal();
            
            // Show success message
            setTimeout(() => {
                showSuccessMessage(data.redirectUrl);
            }, 1500);
            
        } else {
            const errorMessage = data.error || 'Error al procesar la compra';
            showToast('Error de pago', errorMessage, 'error');
        }
        
    } catch (error) {
        console.error('Error en la compra:', error);
        showToast('Error de conexión', 'No se pudo procesar la solicitud. Intenta nuevamente.', 'error');
    } finally {
        hideLoading();
        
        // Reset button state
        if (submitBtn && submitText && submitIcon) {
            setTimeout(() => {
                submitBtn.disabled = false;
                submitText.textContent = 'Verificar y Activar Software';
                submitIcon.textContent = 'verified';
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }, 1000);
        }
    }
}

function showSuccessMessage(redirectUrl) {
    const successModal = document.createElement('div');
    successModal.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4';
    successModal.innerHTML = `
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-md glass-effect rounded-2xl p-8 text-center animate-slide-up">
            <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span class="material-symbols-outlined text-green-400 text-4xl">
                    check_circle
                </span>
            </div>
            
            <h3 class="text-2xl font-bold mb-3">¡Licencia Activada!</h3>
            <p class="text-gray-400 mb-6">
                Tu software de rifas está listo para usar. 
                Hemos enviado los accesos a tu correo electrónico.
            </p>
            
            <div class="bg-black/30 p-4 rounded-xl mb-6 text-left">
                <p class="text-sm text-gray-400 mb-2">Próximos pasos:</p>
                <ul class="space-y-2 text-sm">
                    <li class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-green-400 text-sm">
                            check
                        </span>
                        <span>Revisa tu correo electrónico</span>
                    </li>
                    <li class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-green-400 text-sm">
                            check
                        </span>
                        <span>Configura tu rifa en el panel</span>
                    </li>
                    <li class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-green-400 text-sm">
                            check
                        </span>
                        <span>Comparte tu enlace de ventas</span>
                    </li>
                </ul>
            </div>
            
            <div class="flex gap-3">
                <button 
                    onclick="this.parentElement.parentElement.remove()"
                    class="flex-1 py-3 border border-white/20 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                    Cerrar
                </button>
                
                <button 
                    onclick="window.open('${redirectUrl}', '_blank')"
                    class="flex-1 bg-gradient-primary hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined">
                        open_in_new
                    </span>
                    Ir al Panel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(successModal);
}

// Utility functions
function showLoading(message = 'Procesando...') {
    let loadingOverlay = document.getElementById('loading-overlay');
    
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm';
        loadingOverlay.innerHTML = `
            <div class="glass-effect p-6 rounded-xl text-center max-w-sm">
                <div class="w-12 h-12 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p class="text-white font-medium">${message}</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    } else {
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-[100] glass-effect p-4 rounded-xl border-l-4 ${
        type === 'success' ? 'border-l-green-500' :
        type === 'error' ? 'border-l-red-500' :
        'border-l-blue-500'
    } max-w-sm animate-slide-up`;
    
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="material-symbols-outlined ${
                type === 'success' ? 'text-green-400' :
                type === 'error' ? 'text-red-400' :
                'text-blue-400'
            }">
                ${type === 'success' ? 'check_circle' :
                  type === 'error' ? 'error' :
                  'info'}
            </span>
            <div class="flex-1">
                <h4 class="font-semibold text-sm text-white">${title}</h4>
                <p class="text-gray-300 text-xs mt-1">${message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-white">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}