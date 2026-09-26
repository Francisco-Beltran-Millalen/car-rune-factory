// Fichas de las piezas de la refrigeración (CONTRATOS 4.4), por variante.

import type { PartInfo } from '../../core/types.ts';
import type { CoolingVariant } from './constants.ts';

const ENGINE_BLOCK: PartInfo = {
  name: 'Camisa del motor',
  what: 'Los canales de refrigerante dentro del bloque y la culata.',
  why: 'Se llevan el calor de la combustión: sin ellas el motor se agarrota.',
  how: 'El calor entra por la pared (heatSource) y el refrigerante se lo lleva por advección.',
  failures: ['Con aire en el circuito transfiere peor y el motor recalienta'],
};

const WATER_PUMP: PartInfo = {
  name: 'Bomba de agua',
  what: 'Bomba centrífuga movida por la correa.',
  why: 'Hace circular el refrigerante por el motor y el radiador.',
  how: 'El caudal crece con las rpm y cae con la presión del circuito; los álabes gastados bombean menos.',
  failures: ['Álabes gastados → menos caudal', 'Pierde por el agujero testigo → baja el nivel'],
};

const PUMP_BELT: PartInfo = {
  name: 'Correa de la bomba',
  what: 'La correa que mueve la bomba (y el alternador).',
  why: 'Sin ella la bomba no gira y el motor recalienta.',
  how: 'Si patina, la bomba gira menos que el motor.',
  failures: ['Patina → caudal proporcionalmente menor'],
};

const THERMOSTAT: PartInfo = {
  name: 'Termostato',
  what: 'La válvula térmica que deja pasar el refrigerante al radiador.',
  why: 'Mantiene el motor a temperatura: cerrado calienta rápido, abierto evita el recalentamiento.',
  how: 'La cera abre a partir de 88 °C y con el motor frío todo circula por el bypass.',
  failures: ['Pegado abierto → el motor no llega a temperatura', 'Pegado cerrado → recalienta y hierve'],
};

const BYPASS: PartInfo = {
  name: 'Bypass',
  what: 'El camino corto que evita el radiador.',
  why: 'Con el termostato cerrado el agua igual circula por el motor.',
  how: 'Es un paso poco restrictivo entre la salida del motor y la aspiración de la bomba.',
  failures: ['Obstruido → menos circulación con el motor frío'],
};

const UPPER_HOSE: PartInfo = {
  name: 'Manguera superior',
  what: 'El tubo del termostato al radiador.',
  why: 'Lleva el agua caliente a enfriar.',
  how: 'Del termostato al tanque superior del radiador.',
  failures: ['Rota o floja → pierde refrigerante'],
};

const LOWER_HOSE: PartInfo = {
  name: 'Manguera inferior',
  what: 'El tubo del radiador a la bomba.',
  why: 'Devuelve el agua enfriada al motor.',
  how: 'Del radiador a la aspiración de la bomba.',
  failures: ['Rota → pierde refrigerante y entra aire a la bomba'],
};

const RADIATOR: PartInfo = {
  name: 'Radiador',
  what: 'El intercambiador que entrega calor al aire.',
  why: 'Es el que mantiene la temperatura en régimen.',
  how: 'El agua caliente cede calor por los tubos y el panal; el aire (de marcha o del ventilador) se lo lleva.',
  failures: ['Panal tapado por fuera → menos UA', 'Tubos con sarro → más restricción y menos UA'],
};

const RADIATOR_CAP: PartInfo = {
  name: 'Tapa del radiador',
  what: 'La válvula de presión del sistema.',
  why: 'Presurizar sube el punto de ebullición (107 °C → 129 °C).',
  how: 'Aguanta hasta ~1,1 bar; si falla, el agua hierve a 107 °C.',
  failures: ['No sostiene presión → hierve antes'],
};

const EXPANSION_TANK: PartInfo = {
  name: 'Depósito de expansión',
  what: 'El recipiente que absorbe la dilatación.',
  why: 'Mantiene el circuito lleno y con presión.',
  how: 'Su presión sube con la temperatura: 0,016 bar por grado sobre 20 °C.',
  failures: ['Sin refrigerante la bomba aspira aire'],
};

const HEATER_VALVE: PartInfo = {
  name: 'Llave del calefactor',
  what: 'La válvula que deja pasar agua caliente a la cabina.',
  why: 'Regula cuánto calor entra al habitáculo.',
  how: 'Abre con el control del calefactor; cerrada no circula agua por el radiador de la cabina.',
  failures: ['Trabada → el calefactor no calienta'],
};

const HEATER_CORE: PartInfo = {
  name: 'Calefactor',
  what: 'El radiador chico de la cabina.',
  why: 'Calienta el aire que respiran los ocupantes.',
  how: 'Entrega ~100 W/K al aire de la cabina: con el motor a 90 °C son varios kW.',
  failures: ['Tapado → entrega mucho menos calor'],
};

const TEMP_SENSOR: PartInfo = {
  name: 'Sensor de temperatura',
  what: 'La sonda que mide el refrigerante.',
  why: 'Es el dato que ve la ECU y el tablero.',
  how: 'Va en la salida del motor; si miente, el reloj y la ECU se engañan.',
  failures: ['Marca 30 °C menos → el motor recalienta sin aviso', 'Sin señal → el reloj cae al mínimo'],
};

const TEMP_GAUGE: PartInfo = {
  name: 'Reloj de temperatura',
  what: 'El indicador del tablero.',
  why: 'Es la única ventana del conductor al motor.',
  how: 'Repite la lectura del sensor; la aguja sube de 40 a 110 °C.',
  failures: ['Marca distinto si el sensor falla'],
};

const FAN: PartInfo = {
  name: 'Ventilador',
  what: 'Las aspas que fuerzan aire por el radiador.',
  why: 'Parado o a baja velocidad el aire de marcha no alcanza.',
  how: 'El viscoso gira con el motor y acopla con el calor; el eléctrico prende por termocontacto a 100 °C.',
  failures: ['Muerto → recalienta en tráfico'],
};

const FAN_CLUTCH: PartInfo = {
  name: 'Embrague viscoso',
  what: 'El acople entre el motor y el ventilador.',
  why: 'Deja que el ventilador gire con el motor sólo cuando hace falta.',
  how: 'El silicón acopla más con el radiador caliente; gastado acopla menos.',
  failures: ['Gastado → gira menos y recalienta en tráfico'],
};

const FAN_MOTOR: PartInfo = {
  name: 'Motor del ventilador',
  what: 'El motor eléctrico del electroventilador.',
  why: 'Mueve las aspas sin depender del motor.',
  how: 'Consume unos 10 A a 13,8 V (1,3 Ω) y gira por orden del termocontacto.',
  failures: ['Muerto → el ventilador no gira'],
};

const FAN_SWITCH: PartInfo = {
  name: 'Termocontacto',
  what: 'El interruptor térmico del ventilador.',
  why: 'Prende el ventilador a 100 °C y lo apaga a 95.',
  how: 'Cierra el relé del ventilador con la temperatura del refrigerante.',
  failures: ['Muerto → el ventilador nunca prende'],
};

const FAN_RELAY: PartInfo = {
  name: 'Relé del ventilador',
  what: 'El relé que conmuta la corriente del motor.',
  why: 'El termocontacto no maneja los 10 A directamente.',
  how: 'Cierra el circuito de la batería al motor del ventilador.',
  failures: ['No cierra → el ventilador no gira'],
};

const BATTERY: PartInfo = {
  name: 'Batería',
  what: 'La fuente de 12 V.',
  why: 'Alimenta el electroventilador.',
  how: 'Con el motor en marcha el bus está a ~13,8 V; una batería débil gira más lento el ventilador.',
  failures: ['Baja tensión → menos aire del ventilador'],
};

const FUSE: PartInfo = {
  name: 'Fusible',
  what: 'La protección del circuito del ventilador.',
  why: 'Corta si el motor consume de más.',
  how: 'En el circuito del ventilador, aguas arriba del relé.',
  failures: ['Quemado → el ventilador no gira'],
};

export function createParts(variant: CoolingVariant): Readonly<Record<string, PartInfo>> {
  const parts: Record<string, PartInfo> = {
    engineBlock: ENGINE_BLOCK,
    waterPump: WATER_PUMP,
    pumpBelt: PUMP_BELT,
    thermostat: THERMOSTAT,
    bypass: BYPASS,
    upperHose: UPPER_HOSE,
    lowerHose: LOWER_HOSE,
    radiator: RADIATOR,
    radiatorCap: RADIATOR_CAP,
    expansionTank: EXPANSION_TANK,
    heaterValve: HEATER_VALVE,
    heaterCore: HEATER_CORE,
    tempSensor: TEMP_SENSOR,
    tempGauge: TEMP_GAUGE,
    fan: FAN,
  };
  if (variant === 'viscous') parts['fanClutch'] = FAN_CLUTCH;
  else {
    Object.assign(parts, {
      fanMotor: FAN_MOTOR,
      fanSwitch: FAN_SWITCH,
      fanRelay: FAN_RELAY,
      battery: BATTERY,
      fuse: FUSE,
    });
  }
  return parts;
}
