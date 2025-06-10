import dbManager from "../config/db.js";

export let idUsuario = 0;

export const authenticateUser = async (username, password) => {
  try {
    const userQuery = `
      SELECT Id, Usuario, Password, NombreCompleto
      FROM usuarios
      WHERE Usuario = ?
    `;
    const [user] = await dbManager.executeLocalQuery(userQuery, [username]);

    if (!user) {
      return {
        success: false,
        message: "El usuario es incorrecto.",
      };
    }

    if (user.Password !== password) {
      return {
        success: false,
        message: "La contraseña es incorrecta.",
      };
    }

    idUsuario = user.Id;

    return {
      success: true,
      message: "Inicio de sesión exitoso.",
      user: {
        id: user.Id, 
        username: user.Usuario, 
        NombreCompleto: user.NombreCompleto, 
      },
    };
  } catch (error) {
    console.error("Error en loginService:", error.message);
    throw new Error("Error al autenticar al usuario.");
  }
};