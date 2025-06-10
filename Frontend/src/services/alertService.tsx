import Swal, { SweetAlertIcon } from "sweetalert2";

/**
 * Configuración de alerta personalizada con SweetAlert2
 * Permite múltiples configuraciones y personalizaciones
 */
export const showAlert = ({
  type = "info" as SweetAlertIcon,
  title = "Información",
  text = "",
  showConfirm = true,
  confirmText = "Aceptar",
  onConfirm,
  cancelText,
  showCancel = false,
  denyText,
  showDeny = false,
  onDeny,
  width = '400px',
  padding = '1rem',
  customClass,
  timer,
}: {
  type?: SweetAlertIcon;
  title?: string;
  text?: string;
  showConfirm?: boolean;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  showCancel?: boolean;
  addText?: string;
  showAdd?: boolean;
  denyText?: string;
  showDeny?: boolean;
  onDeny?: () => void;
  width?: string;
  padding?: string;
  customClass?: string;
  timer?: number;
}) => {
  Swal.fire({
    icon: type,
    title: title,
    text: text,
    width: width,
    padding: padding,
    customClass: {
      popup: customClass || '',
    },
    timer: timer,
    timerProgressBar: !!timer,
    showConfirmButton: showConfirm,
    confirmButtonText: confirmText,
    confirmButtonColor: "#02a90d", 
    showCancelButton: showCancel,
    cancelButtonText: cancelText || "Cancelar",
    cancelButtonColor: "#6487f4", 
    showDenyButton: showDeny, 
    denyButtonText: denyText || "Otra opción",
    denyButtonColor: "#fe4646",
  }).then((result) => {
    if (result.isConfirmed && typeof onConfirm === "function") {
      onConfirm();
    } else if (result.isDenied && typeof onDeny === "function") {
      onDeny();
    }
  });
};

/**
 * Muestra una alerta con múltiples opciones de acción personalizadas.
 * @param title Título de la alerta
 * @param text Texto descriptivo de la alerta
 * @param options Arreglo de opciones con texto y acción
 */
export const showSelectionAlert = (
  title: string,
  text: string,
  options: { text: string; action: () => void }[]
) => {
  Swal.fire({
    title,
    text,
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    cancelButtonColor: "#f24c4c",
    showConfirmButton: false,
    html: options
      .map(
        (option, index) =>
          `<button class="swal2-confirm swal2-styled swal2-button${index}" style="margin: 5px;">${option.text}</button>`
      )
      .join(""),
    didOpen: () => {
      options.forEach((option, index) => {
        const button = document.querySelector(`.swal2-button${index}`);
        if (button) {
          button.addEventListener("click", () => {
            Swal.close();
            option.action();
          });
        }
      });
    },
  });
};

/**
 * Muestra una alerta de éxito
 * @param title Título de la alerta
 * @param text Mensaje de éxito
 * @param onConfirm Callback opcional al confirmar
 */
export const showSuccess = (
  title: string, 
  text: string, 
  onConfirm?: () => void
) => {
  showAlert({ 
    type: "success", 
    title, 
    text, 
    onConfirm,
    timer: 3000 // Auto-cierra en 3 segundos
  });
};

/**
 * Muestra una alerta de error
 * @param title Título del error
 * @param text Mensaje de error
 * @param onConfirm Callback opcional al confirmar
 */
export const showError = (
  title: string, 
  text: string, 
  onConfirm?: () => void
) => {
  showAlert({
    type: "error",
    title,
    text,
    onConfirm,
    cancelText: "Cerrar",
    showCancel: true,
    width: '450px'
  });
};

/**
 * Muestra una alerta de advertencia
 * @param title Título de la advertencia
 * @param text Mensaje de advertencia
 * @param onConfirm Callback opcional al confirmar
 */
export const showWarning = (
  title: string, 
  text: string, 
  onConfirm?: () => void
) => {
  showAlert({ 
    type: "warning", 
    title, 
    text, 
    onConfirm 
  });
};

/**
 * Muestra una alerta de confirmación con dos botones
 * @param title Título de la confirmación
 * @param text Mensaje de confirmación
 * @param onConfirm Callback al confirmar
 * @param confirmText Texto personalizado para botón de confirmación
 */
export const showConfirm = (
  title: string,
  text: string,
  onConfirm: () => void,
  confirmText: string = "Confirmar",
  type: SweetAlertIcon = "question" 
) => {
  showAlert({
    type, 
    title,
    text,
    onConfirm,
    confirmText,
    cancelText: "Cancelar",
    showCancel: true,
    width: "450px",
  });
};


/**
 * Muestra una alerta con opción adicional
 * @param title Título de la alerta
 * @param text Mensaje de la alerta
 * @param onConfirm Callback al confirmar
 * @param addText Texto personalizado para botón adicional
 */
export const showAddOption = (
  title: string,
  text: string,
  onConfirm: () => void,
  addText: string = "Agregar"
) => {
  showAlert({
    type: "info",
    title,
    text,
    onConfirm,
    addText,
    showAdd: true,
    width: '450px'
  });
};

export const showConfirmWithQuantity = (
  title: string,
  text: string,
  inputPlaceholder: string,
  onConfirm: (quantity: number) => void,
  confirmText: string = "Sí, agregar"
) => {
  Swal.fire({
    icon: "question",
    title: title,
    html: `
      <p style="font-size: 18px;">${text}</p>
      <input id="cantidadFardos" type="number" min="1" pattern="[0-9]*"
        class="swal2-input border border-black" placeholder="${inputPlaceholder}"
        oninput="this.value = this.value.replace(/[^0-9]/g, '')"
        style="width: 80%; font-size: 18px;">
    `,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#15803D",
    cancelButtonColor: "#DC2626",
    preConfirm: () => {
      const inputElement = document.getElementById("cantidadFardos") as HTMLInputElement;
      const cantidad = Number(inputElement.value);

      if (!cantidad || cantidad <= 0) {
        Swal.showValidationMessage("Ingrese una cantidad válida.");
        return false;
      }

      return cantidad;
    }
  }).then((result) => {
    if (result.isConfirmed) {
      onConfirm(result.value);
    }
  });
};

/**
 * Muestra una alerta con HTML personalizado y tres botones: "Sí, sumar", "No sumar", y "Cancelar"
 * @param title Título de la alerta
 * @param html Contenido HTML personalizado
 * @param confirmText Texto del botón principal (sí)
 * @param onConfirm Callback si el usuario confirma
 * @param onNoSumar Callback si elige no sumar
 */
export const showConfirmWithHTML = (
  title: string,
  html: string,
  confirmText: string,
  onConfirm: () => void,
  onNoSumar: () => void
) => {
  Swal.fire({
    title,
    html,
    icon: "question",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: confirmText,     // "Sí, sumar"
    denyButtonText: "No sumar",         // "No sumar"
    cancelButtonText: "Cancelar",       // "Cancelar"
    confirmButtonColor: "#15803D",
    denyButtonColor: "#f47e35",
    cancelButtonColor: "#DC2626"
  }).then((result) => {
    if (result.isConfirmed) {
      onConfirm();
    } else if (result.isDenied) {
      onNoSumar();
    }
    // Si cancela, no hace nada
  });
};


/**
 * Muestra una alerta de éxito personalizada con HTML y dos botones: "Aceptar" y "Cancelar"
 * @param title Título de la alerta
 * @param html Contenido HTML personalizado
 * @param confirmText Texto del botón de aceptar (por defecto: "Aceptar")
 * @param onConfirm Callback si el usuario confirma
 */
export const showCustomSuccess = (
  title: string,
  html: string,
  confirmText: string = "Aceptar",
  onConfirm: () => void
) => {
  Swal.fire({
    title,
    html,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#15803D",  // Verde para aceptar
    cancelButtonColor: "#DC2626"    // Rojo para cancelar
  }).then((result) => {
    if (result.isConfirmed) {
      onConfirm();
    }
    // Si cancela, no hace nada
  });
};