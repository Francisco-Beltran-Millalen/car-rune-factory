// Fichas de las piezas de la lubricación (CONTRATOS 4.4), por variante.

import type { PartInfo } from '../../core/types.ts';
import type { LubricationVariant } from './constants.ts';

const SUMP: PartInfo = {
  name: 'Cárter',
  what: 'El depósito de aceite en la base del motor.',
  why: 'Guarda el aceite y deja que la bomba lo aspire.',
  how: 'En curvas el aceite se corre hacia un costado y el chupador puede quedar al aire.',
  failures: ['Poco aceite → la bomba aspira aire', 'Tapón flojo → gotea'],
};

const DRAIN_PLUG: PartInfo = {
  name: 'Tapón de vaciado',
  what: 'El tornillo que cierra el cárter.',
  why: 'Permite cambiar el aceite.',
  how: 'Con su arandela sella; si gotea, el nivel baja de a poco.',
  failures: ['Gotea → consumo lento de aceite'],
};

const PICKUP: PartInfo = {
  name: 'Chupador con rejilla',
  what: 'La boca de aspiración con su filtro grueso.',
  why: 'Retiene las partículas grandes antes de la bomba.',
  how: 'Sumergido en el aceite; si se tapa, la bomba cavita y la presión cae.',
  failures: ['Rejilla tapada → cavitación a altas rpm'],
};

const OIL_PUMP: PartInfo = {
  name: 'Bomba de aceite',
  what: 'Bomba de engranajes de desplazamiento positivo.',
  why: 'Da presión y caudal a todo el circuito.',
  how: 'El caudal crece con las rpm y la fuga interna con la presión; gastada, bombea menos.',
  failures: ['Gastada → menos caudal y menos presión'],
};

const RELIEF_VALVE: PartInfo = {
  name: 'Válvula de alivio',
  what: 'La válvula que limita la presión máxima.',
  why: 'Con el aceite frío o el motor acelerado sobra caudal.',
  how: 'Abre a 4,5 bar y devuelve el sobrante al cárter; trabada abierta, la presión no sube.',
  failures: ['Trabada abierta → presión baja en todo el rango'],
};

const OIL_FILTER: PartInfo = {
  name: 'Filtro de aceite',
  what: 'El filtro que limpia las partículas finas.',
  why: 'El aceite sucio desgasta los cojinetes.',
  how: 'Cartucho en carcasa (años 70) o enroscable con antirretorno (años 2000); si se tapa, abre su bypass.',
  failures: ['Tapado → abre el bypass y pasa aceite sin filtrar', 'Junta que pierde → baja el nivel rápido'],
};

const FILTER_BYPASS: PartInfo = {
  name: 'Válvula de bypass del filtro',
  what: 'La válvula que saltea el filtro tapado.',
  why: 'Es mejor aceite sucio que ningún aceite.',
  how: 'Abre a 1 bar de caída: con el filtro tapado la presión no se pierde.',
  failures: ['Abierta siempre → el aceite nunca se filtra'],
};

const GALLERY: PartInfo = {
  name: 'Galería principal',
  what: 'El conducto que reparte el aceite a presión.',
  why: 'Lleva el aceite a bancada, bielas y culata.',
  how: 'Es un volumen pequeño que amortigua los pulsos de la bomba.',
  failures: ['Pérdida en la galería → presión baja y fugas'],
};

const MAIN_BEARINGS: PartInfo = {
  name: 'Cojinetes de bancada',
  what: 'Los cojinetes del cigüeñal.',
  why: 'Sostienen el cigüeñal sobre una película de aceite.',
  how: 'El aceite a presión mantiene separadas las piezas; con holgura se escapa más.',
  failures: ['Gastados → más caudal de fuga y menos presión'],
};

const ROD_BEARINGS: PartInfo = {
  name: 'Cojinetes de biela',
  what: 'Los cojinetes de las bielas.',
  why: 'Reciben la carga de la combustión.',
  how: 'Se lubrican por el cigüeñal; con holgura golpetean.',
  failures: ['Gastados → golpeteo y menos presión'],
};

const CAM_BEARINGS: PartInfo = {
  name: 'Cojinetes del árbol de levas',
  what: 'Los cojinetes de la leva.',
  why: 'Mantienen alineado el árbol de levas.',
  how: 'Reciben el aceite al final de la galería (culata).',
  failures: ['Gastados → menos presión y desgaste de levas'],
};

const PRESSURE_SWITCH: PartInfo = {
  name: 'Interruptor de presión',
  what: 'El sensor de baja presión.',
  why: 'Prende el testigo cuando la presión cae de 0,5 bar.',
  how: 'Cierra a masa con la llave puesta; el testigo se prueba al poner Contacto.',
  failures: ['Trabado abierto o cerrado → el testigo miente'],
};

const WARNING_LAMP: PartInfo = {
  name: 'Testigo de aceite',
  what: 'La luz roja del tablero.',
  why: 'Avisa al conductor de una pérdida de presión.',
  how: 'Se alimenta del bus por la llave y cierra a masa por el interruptor.',
  failures: ['Ampolleta quemada → no avisa'],
};

const BATTERY: PartInfo = {
  name: 'Batería',
  what: 'La fuente de 12 V.',
  why: 'Alimenta el testigo.',
  how: 'Con el motor en marcha el bus está a ~13,8 V.',
  failures: ['Baja tensión → el testigo alumbra menos'],
};

const KEY: PartInfo = {
  name: 'Llave de contacto',
  what: 'El interruptor general.',
  why: 'Con Contacto el testigo se prueba (debe prender).',
  how: 'Cierra el circuito del tablero.',
  failures: ['Contactos gastados → el testigo no prende'],
};

const OIL_GAUGE: PartInfo = {
  name: 'Manómetro de aceite',
  what: 'El reloj de presión del tablero.',
  why: 'Muestra la presión real, no sólo un umbral.',
  how: 'Sigue a la galería con una constante de 0,3 s.',
  failures: ['Miente si su sensor falla'],
};

const ANTI_DRAINBACK: PartInfo = {
  name: 'Válvula antirretorno',
  what: 'La válvula del filtro enroscable que lo mantiene lleno.',
  why: 'Evita que el aceite vuelva al cárter detenido.',
  how: 'Si se vence, al arrancar la bomba tarda unos segundos en llenar el filtro y dar presión.',
  failures: ['Vencida → 3 s sin presión al partir'],
};

export function createParts(variant: LubricationVariant): Readonly<Record<string, PartInfo>> {
  const parts: Record<string, PartInfo> = {
    sump: SUMP,
    drainPlug: DRAIN_PLUG,
    pickup: PICKUP,
    oilPump: OIL_PUMP,
    reliefValve: RELIEF_VALVE,
    oilFilter: OIL_FILTER,
    filterBypass: FILTER_BYPASS,
    mainGallery: GALLERY,
    mainBearings: MAIN_BEARINGS,
    rodBearings: ROD_BEARINGS,
    camBearings: CAM_BEARINGS,
    pressureSwitch: PRESSURE_SWITCH,
    warningLamp: WARNING_LAMP,
    battery: BATTERY,
    key: KEY,
  };
  if (variant === 'gauge') parts['oilGauge'] = OIL_GAUGE;
  else parts['antiDrainback'] = ANTI_DRAINBACK;
  return parts;
}
