# generate_keys.py
# Importamos la clase Vapid desde py_vapid
from py_vapid import Vapid

# Creamos una instancia de Vapid
# Al inicializar, genera un nuevo par de claves automáticamente.
vapid = Vapid()

# Obtenemos las claves pública y privada directamente en formato Base64 URL
public_key_b64 = vapid.public_key_b64
private_key_b64 = vapid.private_key_b64

# Imprime las claves
print("¡Claves VAPID generadas con éxito!")
print("\n--- Clave Pública VAPID (Base64 URL) ---")
print(public_key_b64)
print("\n--- Clave Privada VAPID (Base64 URL) ---")
print(private_key_b64)
print("\nPor favor, copia estas claves y configúralas como variables de entorno.")



