// Fichas de las piezas del encendido (CONTRATOS 4.4), por variante.

import type { PartInfo } from '../../core/types.ts';
import type { IgnitionVariant } from './constants.ts';

const BATTERY: PartInfo = {
  name: 'Batería',
  what: 'La fuente de 12 V del auto.',
  why: 'Sin tensión no se carga la bobina y no hay chispa.',
  how: 'El sistema la mide como una fuente real con resistencia interna: con el motor apagado entrega ~12,6 V.',
  failures: ['Batería débil → chispa pobre en alta'],
};

const KEY: PartInfo = {
  name: 'Llave de contacto',
  what: 'El interruptor general del encendido.',
  why: 'Conecta la batería con la bobina en Contacto y Marcha.',
  how: 'En Arranque, además, cierra el puente que saltea el balasto (en los platinos).',
  failures: ['Contactos gastados → tensión baja en la bobina'],
};

const COIL: PartInfo = {
  name: 'Bobina',
  what: 'El transformador que eleva los 12 V a decenas de kV.',
  why: 'La bujía necesita miles de volts para que salte el arco.',
  how: 'El primario (R baja, L ~mH) se carga durante el dwell; al cortarse, la energía ½·L·i² pasa al secundario.',
  failures: ['Bobina débil (L baja) → menos energía y chispa pobre', 'Primario abierto o en corto → sin chispa'],
};

const PLUG: PartInfo = {
  name: 'Bujía',
  what: 'El electrodo donde salta la chispa.',
  why: 'Enciende la mezcla en el momento exacto.',
  how: 'El voltaje disponible debe superar el pedido: más separación y más presión piden más kV.',
  failures: ['Separación gastada → hace falta más voltaje (falla en alta)', 'Bujía engrasada → derivación y chispa débil'],
};

const SCOPE: PartInfo = {
  name: 'Osciloscopio',
  what: 'La pantalla de diagnóstico del encendido.',
  why: 'Muestra la rampa de corriente del primario y el pico del secundario.',
  how: 'Con el canal de corriente se mide el dwell y el corte; con el de tensión, el voltaje de ruptura y el arco.',
  failures: ['Trazo sin rampa → el primario no se carga'],
};

const BALLAST: PartInfo = {
  name: 'Resistencia balasto',
  what: 'Una resistencia en serie con el primario clásico.',
  why: 'Limita la corriente en marcha y alarga la vida de los platinos.',
  how: 'En Arranque se puentea para que la chispa sea fuerte con la batería caída; si se corta, en Marcha no llega corriente.',
  failures: ['Balasto cortado → arranca y se apaga al soltar la llave'],
};

const START_BRIDGE: PartInfo = {
  name: 'Puente de arranque',
  what: 'El contacto del burro de arranque que salta el balasto.',
  why: 'Al arrancar la batería cae: sin balasto la bobina recibe toda la tensión que queda.',
  how: 'Se cierra sólo con la llave en Arranque; al soltarla, la corriente vuelve a pasar por el balasto.',
  failures: ['Con el balasto cortado, el motor arranca por el puente y se apaga al soltar la llave'],
};

const POINTS: PartInfo = {
  name: 'Platinos',
  what: 'El contacto mecánico que corta el primario.',
  why: 'Al abrirse corta la corriente y dispara la chispa.',
  how: 'Una leva de 4 lóbulos los abre en el orden 1-3-4-2; cuanto más separados, menos dwell y más avance.',
  failures: ['Separación excesiva → poca carga y avance adelantado', 'Contactos picados → resistencia extra en el primario'],
};

const CONDENSER: PartInfo = {
  name: 'Condensador',
  what: 'Un capacitor en paralelo con los platinos.',
  why: 'Se come el arco que saltaría entre los contactos al abrir.',
  how: 'Sin él la energía se disipa en el arco: la chispa queda débil y los platinos se pican.',
  failures: ['Abierto → chispa débil y picado', 'En corto → el primario nunca se corta: no hay chispa'],
};

const DISTRIBUTOR: PartInfo = {
  name: 'Distribuidor',
  what: 'El eje que reparte la alta tensión y mueve los platinos.',
  why: 'Reparte la chispa entre los 4 cilindros en el orden 1-3-4-2.',
  how: 'Gira con la leva; el rotor barre los terminales de la tapa y la leva abre los platinos.',
  failures: ['Juego del eje → desfase variable', 'Rotor o tapa gastados → fuga de alta'],
};

const ROTOR: PartInfo = {
  name: 'Rotor',
  what: 'El brazo giratorio que lleva la alta al terminal del cilindro activo.',
  why: 'Conecta la bobina con cada bujía en su turno.',
  how: 'Gira con la leva; su punta barre los 4 terminales de la tapa.',
  failures: ['Gastado → pide más voltaje para saltar el entrehierro'],
};

const CAP: PartInfo = {
  name: 'Tapa del distribuidor',
  what: 'La tapa con los 4 terminales y el central.',
  why: 'Reparte el cable central entre los cables de las bujías.',
  how: 'El rotor pasa cerca de cada terminal; una fisura deja escapar la alta a masa.',
  failures: ['Fisurada → falla por humedad (fuga a masa)'],
};

const COIL_LEAD: PartInfo = {
  name: 'Cable central',
  what: 'El cable de la bobina al distribuidor.',
  why: 'Lleva la alta tensión hasta la tapa.',
  how: 'Va del secundario de la bobina al terminal central.',
  failures: ['Aislación rota → fuga a masa'],
};

const HT_LEAD: PartInfo = {
  name: 'Cable de bujía',
  what: 'El cable de la tapa a cada bujía.',
  why: 'Lleva la alta hasta el electrodo.',
  how: 'Uno por cilindro, del terminal de la tapa a la bujía.',
  failures: ['Cortado → ese cilindro no enciende'],
};

const CENTRIFUGAL: PartInfo = {
  name: 'Avance centrífugo',
  what: 'Los contrapesos que adelantan la chispa con las rpm.',
  why: 'A más rpm la combustión necesita más anticipación.',
  how: 'A 3000 rpm aportan unos 24°; trabados, el motor queda sin avance.',
  failures: ['Trabado → avance fijo y pérdida de potencia'],
};

const VACUUM_ADVANCE: PartInfo = {
  name: 'Avance por vacío',
  what: 'La cápsula que adelanta la chispa en crucero.',
  why: 'Con la mariposa entreabierta el vacío del múltiple pide más avance.',
  how: 'El diafragma mueve la placa de los platinos según el vacío de puerto.',
  failures: ['Diafragma roto → no adelanta y entra aire falso al múltiple'],
};

const VACUUM_LINE: PartInfo = {
  name: 'Manguera de vacío',
  what: 'El tubo que lleva el vacío del múltiple a la cápsula.',
  why: 'Conecta la señal de carga con el avance.',
  how: 'Toma el vacío de puerto: sólo hay señal con la mariposa abierta.',
  failures: ['Suelta → el avance por vacío no funciona'],
};

const ECU: PartInfo = {
  name: 'ECU',
  what: 'La computadora del motor.',
  why: 'Decide el avance, el dwell y el corte de cada bobina.',
  how: 'Cruza las señales de los sensores de cigüeñal y leva con su mapa.',
  failures: ['Código P0016 → correlación cigüeñal/leva fuera de tolerancia', 'Código P0340 → no ve el sensor de leva'],
};

const CRANK_SENSOR: PartInfo = {
  name: 'Sensor de cigüeñal',
  what: 'El sensor que lee la rueda dentada del cigüeñal.',
  why: 'Es la base de tiempo de la ECU: sin él no hay chispa ni inyección.',
  how: 'Cuenta los dientes de la rueda 60-2; con mucha separación la señal es débil.',
  failures: ['Muerto → sin chispa', 'Con separación → no sincroniza a bajas rpm'],
};

const TOOTH_WHEEL: PartInfo = {
  name: 'Rueda dentada 60-2',
  what: 'La rueda con 60 dientes menos 2.',
  why: 'El hueco de dos dientes marca la posición del cigüeñal.',
  how: 'Gira con el cigüeñal; el sensor cuenta dientes y detecta el hueco.',
  failures: ['Dientes dañados → señal irregular'],
};

const CAM_SENSOR: PartInfo = {
  name: 'Sensor de leva',
  what: 'El sensor que distingue el ciclo de 720°.',
  why: 'Sin él la ECU no sabe en qué vuelta está cada cilindro.',
  how: 'Con su señal la chispa es secuencial; sin él pasa a chispa perdida.',
  failures: ['Muerto → chispa perdida y código P0340'],
};

const IGNITER: PartInfo = {
  name: 'Igniter',
  what: 'El módulo de potencia que corta cada bobina.',
  why: 'Reemplaza a los platinos: corta la corriente sin desgaste.',
  how: 'Recibe la orden de la ECU y limita la corriente del primario (8 A).',
  failures: ['Muerto → ninguna chispa'],
};

export function createParts(variant: IgnitionVariant): Readonly<Record<string, PartInfo>> {
  const parts: Record<string, PartInfo> = {
    battery: BATTERY,
    key: KEY,
    scope: SCOPE,
  };
  for (let i = 1; i <= 4; i++) parts[`sparkPlug${i}`] = PLUG;
  if (variant === 'points') {
    Object.assign(parts, {
      coil: COIL,
      ballast: BALLAST,
      startBridge: START_BRIDGE,
      points: POINTS,
      condenser: CONDENSER,
      distributor: DISTRIBUTOR,
      rotor: ROTOR,
      distributorCap: CAP,
      coilLead: COIL_LEAD,
      centrifugalAdvance: CENTRIFUGAL,
      vacuumAdvance: VACUUM_ADVANCE,
      vacuumLine: VACUUM_LINE,
    });
    for (let i = 1; i <= 4; i++) parts[`htLead${i}`] = HT_LEAD;
  } else {
    Object.assign(parts, {
      coil1: COIL,
      coil2: COIL,
      coil3: COIL,
      coil4: COIL,
      ecu: ECU,
      crankSensor: CRANK_SENSOR,
      toothWheel: TOOTH_WHEEL,
      camSensor: CAM_SENSOR,
      igniter: IGNITER,
    });
  }
  return parts;
}
