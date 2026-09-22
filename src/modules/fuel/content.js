// Fichas de cada pieza (PartInfo). Los partId coinciden con los data-part de view.js (§10).

const injector = (n) => ({
  name: `Inyector ${n}`,
  what: 'Una válvula eléctrica (solenoide) con una tobera muy fina en la punta.',
  why: 'Pulveriza la bencina en el múltiple de admisión, justo antes de la válvula de admisión del cilindro.',
  how:
    'La ECU le da un pulso de corriente: la bobina levanta la aguja y la bencina sale pulverizada por la diferencia de presión (≈ 3 bar). ' +
    'La cantidad depende del tiempo de apertura (ancho de pulso, 2–12 ms) y de esa diferencia de presión. Se abren en el orden de encendido 1-3-4-2.',
  failures: [
    'Gotea → cuesta partir en caliente, huele a bencina, pierde la presión residual',
    'Tapado → ese cilindro queda pobre, el motor tiembla en ralentí',
    'Bobina cortada → ese cilindro no recibe combustible',
  ],
});

export const parts = {
  battery: {
    name: 'Batería',
    what: 'Batería de plomo-ácido de 12 V.',
    why: 'Alimenta la bomba de combustible, la ECU y los inyectores.',
    how: 'Con el motor detenido entrega ~12,6 V. Con el motor en marcha el alternador sube la tensión a ~14 V. Al arrancar cae unos 2 V por el consumo del motor de partida.',
    failures: ['Tensión baja → la bomba gira más lento y entrega menos presión y caudal'],
  },
  key: {
    name: 'Llave de contacto',
    what: 'El interruptor que maneja el conductor: Apagado, Contacto, Arranque y Marcha.',
    why: 'Da energía a la ECU y le indica cuándo arrancar el motor.',
    how: 'En "Contacto" la ECU enciende la bomba unos 2 s para presurizar el riel (cebado). En "Arranque" gira el motor de partida. En "Marcha" la bomba sólo funciona si el motor gira.',
    failures: ['Contacto defectuoso → la ECU o la bomba se apagan de golpe'],
  },
  relay: {
    name: 'Relé de la bomba',
    what: 'Un interruptor electromagnético: una corriente pequeña de la ECU conecta la corriente grande de la bomba.',
    why: 'La ECU no puede manejar directamente los 4–8 A de la bomba. El relé lo hace por ella.',
    how: 'La ECU lo cierra durante el cebado y mientras recibe señal de giro del motor. Si el motor se detiene, lo abre por seguridad: en un choque no debe seguir saliendo bencina.',
    failures: [
      'Relé muerto → la bomba nunca funciona: el motor gira y no parte',
      'Contactos gastados → cortes intermitentes: tirones o el motor se apaga de la nada',
    ],
  },
  ecu: {
    name: 'ECU (computador del motor)',
    what: 'La unidad de control electrónica del motor.',
    why: 'Decide cuánto combustible inyectar y cuándo, y maneja el relé de la bomba.',
    how: 'Lee rpm y carga (acelerador / vacío) y calcula el ancho de pulso de cada inyector suponiendo que el regulador mantiene 3 bar sobre el múltiple. Si la presión real es distinta, la mezcla sale más pobre o más rica de lo calculado.',
    failures: ['Si la presión de combustible no es la correcta, la ECU inyecta mal sin saberlo (sin sonda lambda no se corrige)'],
  },
  tank: {
    name: 'Estanque de combustible',
    what: 'El depósito de bencina, normalmente bajo el asiento trasero. Unos 50 L.',
    why: 'Guarda el combustible. Además recibe de vuelta el sobrante que devuelve el regulador.',
    how: 'La bomba va sumergida adentro. La bencina que retorna ayuda a enfriar la bomba y el estanque.',
    failures: ['Casi vacío → la bomba aspira aire en las curvas o subidas: tirones', 'Suciedad en el fondo → tapa el colador'],
  },
  strainer: {
    name: 'Colador (pre-filtro)',
    what: 'Una malla de tela en la entrada de la bomba.',
    why: 'Detiene las partículas grandes antes de que entren a la bomba.',
    how: 'Toda la bencina que sale del estanque pasa primero por aquí.',
    failures: ['Tapado → la bomba se "ahoga": menos caudal, zumba más fuerte'],
  },
  pump: {
    name: 'Bomba eléctrica de combustible',
    what: 'Un motor eléctrico con una bomba de rodillos o turbina, sumergido en el estanque.',
    why: 'Empuja la bencina desde el estanque hasta el riel de inyección a presión.',
    how: 'Entrega siempre más de lo que el motor consume (≈ 70–120 L/h) y el sobrante vuelve por el retorno. Mientras más presión le piden, menos caudal entrega. Si la dejan sin salida, llega a su presión máxima (~6,5 bar).',
    failures: [
      'Gastada → no alcanza el caudal a alta carga: el motor se queda sin fuerza al acelerar',
      'Con batería baja entrega menos',
      'Hace ruido (zumbido) cuando aspira aire o está tapada',
    ],
  },
  checkValve: {
    name: 'Válvula antirretorno (check)',
    what: 'Una válvula de un solo sentido a la salida de la bomba.',
    why: 'Con la bomba apagada impide que la bencina vuelva al estanque, así el riel conserva la presión residual y el motor parte rápido.',
    how: 'Se abre con el flujo hacia el motor y un resorte la cierra cuando el flujo se detiene.',
    failures: ['Si no cierra → la presión residual se pierde: cuesta partir (sobre todo en caliente)'],
  },
  feedLine: {
    name: 'Línea de alimentación',
    what: 'La cañería metálica o manguera que va del estanque al motor.',
    why: 'Lleva la bencina a presión hasta el riel.',
    how: 'Recorre el piso del auto. Tiene algo de elasticidad, que junto al riel amortigua los pulsos de los inyectores.',
    failures: ['Fuga → olor a bencina, pérdida de presión, riesgo de incendio'],
  },
  filter: {
    name: 'Filtro de combustible',
    what: 'Un cartucho de papel filtrante dentro de un cuerpo metálico.',
    why: 'Retiene la suciedad fina que podría tapar las toberas de los inyectores.',
    how: 'Tiene un sentido de flujo (flecha). Nuevo, casi no frena el paso (~0,1 bar). Al ensuciarse la caída de presión crece con el cuadrado del caudal: se nota a alta carga, no en ralentí.',
    failures: ['Tapado → anda bien en ralentí pero tironea y pierde fuerza al acelerar o en subida'],
  },
  rail: {
    name: 'Riel de inyección',
    what: 'Un tubo común que alimenta a los 4 inyectores.',
    why: 'Reparte la bencina a la misma presión a todos los inyectores.',
    how: 'Tiene el regulador de presión en un extremo. El manómetro de taller se conecta aquí (válvula tipo Schrader).',
    failures: ['Presión baja en el riel → mezcla pobre', 'Presión alta → mezcla rica'],
  },
  injector1: injector(1),
  injector2: injector(2),
  injector3: injector(3),
  injector4: injector(4),
  manifold: {
    name: 'Múltiple de admisión',
    what: 'Los conductos que llevan el aire desde la mariposa hasta cada cilindro.',
    why: 'Aquí se mezcla el aire con la bencina pulverizada.',
    how: 'Con la mariposa casi cerrada (ralentí) los pistones crean un vacío fuerte (≈ −0,65 bar). A fondo, la presión sube casi a la atmosférica.',
    failures: ['Entrada de aire falso → mezcla pobre, ralentí inestable'],
  },
  regulator: {
    name: 'Regulador de presión',
    what: 'Una válvula con diafragma y resorte en el extremo del riel.',
    why: 'Mantiene la presión del riel siempre 3 bar por sobre la presión del múltiple. Así la cantidad inyectada depende sólo del tiempo de apertura.',
    how: 'Cuando la presión supera la fuerza del resorte, el diafragma se abre y deja volver el sobrante al estanque. El vacío del múltiple actúa sobre el diafragma: en ralentí la presión absoluta del riel baja (~2,35 bar) y a fondo sube (~3 bar).',
    failures: [
      'Pegado abierto → casi no hay presión: el motor gira y no parte',
      'Pegado cerrado → presión al máximo de la bomba: mezcla muy rica, humo negro',
      'Diafragma roto → bencina por la manguera de vacío: consumo alto, mezcla rica',
    ],
  },
  vacuumHose: {
    name: 'Manguera de vacío del regulador',
    what: 'Una manguera fina de goma entre el múltiple y el regulador.',
    why: 'Le "avisa" al regulador la presión del múltiple para que mantenga los 3 bar de diferencia.',
    how: 'Transmite el vacío al lado del resorte del diafragma.',
    failures: ['Suelta o rota → en ralentí la presión sube ~0,6 bar: mezcla rica, ralentí irregular'],
  },
  returnLine: {
    name: 'Línea de retorno',
    what: 'La cañería que devuelve el sobrante al estanque.',
    why: 'Por aquí vuelve todo lo que la bomba entrega y el motor no consume.',
    how: 'En ralentí vuelve casi todo (≈ 75 L/h). A fondo vuelve menos porque los inyectores consumen más.',
    failures: ['Tapada o aplastada → el regulador no puede descargar: presión alta'],
  },
};
