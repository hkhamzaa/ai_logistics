import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.payment.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: 'Alice Nakamura',
        phone: '+14155550101',
        email: 'alice@example.com',
        isVip: true,
        paypalCaptureId: 'CAP_ALICE_001',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'David Chen',
        phone: '+14155550102',
        email: 'david@example.com',
        isVip: true,
        paypalCaptureId: 'CAP_DAVID_002',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Maria Santos',
        phone: '+14155550103',
        email: 'maria@example.com',
        isVip: false,
        paypalCaptureId: 'CAP_MARIA_003',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'James Okafor',
        phone: '+14155550104',
        email: 'james@example.com',
        isVip: false,
        paypalCaptureId: 'CAP_JAMES_004',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Priya Mehta',
        phone: '+14155550105',
        email: 'priya@example.com',
        isVip: false,
        paypalCaptureId: 'CAP_PRIYA_005',
      },
    }),
    prisma.customer.create({
      data: {
        name: 'Lucas Ferreira',
        phone: '+14155550106',
        email: 'lucas@example.com',
        isVip: false,
        paypalCaptureId: 'CAP_LUCAS_006',
      },
    }),
  ]);

  const vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        label: 'Truck Alpha',
        status: 'enroute',
        currentLat: 37.7749,
        currentLng: -122.4194,
        speedKph: 45,
        routeProgress: 0.15,
      },
    }),
    prisma.vehicle.create({
      data: {
        label: 'Truck Bravo',
        status: 'enroute',
        currentLat: 34.0522,
        currentLng: -118.2437,
        speedKph: 60,
        routeProgress: 0.4,
      },
    }),
    prisma.vehicle.create({
      data: {
        label: 'Van Charlie',
        status: 'idle',
        currentLat: 40.7128,
        currentLng: -74.006,
        speedKph: 0,
        routeProgress: 0,
      },
    }),
    prisma.vehicle.create({
      data: {
        label: 'Van Delta',
        status: 'stopped',
        currentLat: 41.8781,
        currentLng: -87.6298,
        speedKph: 0,
        routeProgress: 0.7,
      },
    }),
  ]);

  const now = new Date();
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

  await Promise.all([
    // VIP shipment enroute — SLA comfortable
    prisma.shipment.create({
      data: {
        customerId: customers[0]!.id,
        vehicleId: vehicles[0]!.id,
        originLat: 37.3382,
        originLng: -121.8863,
        destLat: 37.7749,
        destLng: -122.4194,
        status: 'enroute',
        slaDeadline: hoursFromNow(4),
        currentEta: hoursFromNow(2),
        riskScore: 20,
        anomalyScore: 5,
        declaredValue: 250,
      },
    }),
    // VIP shipment enroute — SLA tight → engine should fire
    prisma.shipment.create({
      data: {
        customerId: customers[1]!.id,
        vehicleId: vehicles[1]!.id,
        originLat: 34.0195,
        originLng: -118.4912,
        destLat: 34.0522,
        destLng: -118.2437,
        status: 'enroute',
        slaDeadline: hoursFromNow(1),
        currentEta: hoursFromNow(2),
        riskScore: 75,
        anomalyScore: 10,
        declaredValue: 400,
      },
    }),
    // Standard enroute — SLA already violated
    prisma.shipment.create({
      data: {
        customerId: customers[2]!.id,
        vehicleId: vehicles[0]!.id,
        originLat: 40.6501,
        originLng: -73.9496,
        destLat: 40.7128,
        destLng: -74.006,
        status: 'enroute',
        slaDeadline: hoursAgo(1),
        currentEta: hoursFromNow(1),
        riskScore: 95,
        anomalyScore: 15,
        refundStatus: 'none',
        declaredValue: 150,
      },
    }),
    // Standard enroute — high risk
    prisma.shipment.create({
      data: {
        customerId: customers[3]!.id,
        vehicleId: vehicles[3]!.id,
        originLat: 41.8827,
        originLng: -87.6233,
        destLat: 41.8781,
        destLng: -87.6298,
        status: 'enroute',
        slaDeadline: hoursFromNow(0.5),
        currentEta: hoursFromNow(2),
        riskScore: 85,
        anomalyScore: 20,
        declaredValue: 200,
      },
    }),
    // Suspected lost — anomaly high
    prisma.shipment.create({
      data: {
        customerId: customers[4]!.id,
        vehicleId: vehicles[3]!.id,
        originLat: 41.8781,
        originLng: -87.6298,
        destLat: 41.9742,
        destLng: -87.9073,
        status: 'enroute',
        slaDeadline: hoursFromNow(2),
        currentEta: hoursFromNow(5),
        riskScore: 60,
        anomalyScore: 85,
        declaredValue: 300,
      },
    }),
    // Delivered — no action needed
    prisma.shipment.create({
      data: {
        customerId: customers[5]!.id,
        vehicleId: null,
        originLat: 37.7749,
        originLng: -122.4194,
        destLat: 37.3382,
        destLng: -121.8863,
        status: 'delivered',
        slaDeadline: hoursAgo(2),
        currentEta: hoursAgo(2.5),
        riskScore: 0,
        anomalyScore: 0,
        declaredValue: 80,
      },
    }),
    // Created — not yet picked up
    prisma.shipment.create({
      data: {
        customerId: customers[0]!.id,
        vehicleId: null,
        originLat: 37.7749,
        originLng: -122.4194,
        destLat: 37.8716,
        destLng: -122.2727,
        status: 'created',
        slaDeadline: hoursFromNow(8),
        currentEta: null,
        riskScore: 5,
        anomalyScore: 0,
        declaredValue: 175,
      },
    }),
    // SLA violated + refund pending approval
    prisma.shipment.create({
      data: {
        customerId: customers[2]!.id,
        vehicleId: vehicles[2]!.id,
        originLat: 40.7128,
        originLng: -74.006,
        destLat: 40.7580,
        destLng: -73.9855,
        status: 'enroute',
        slaDeadline: hoursAgo(3),
        currentEta: hoursFromNow(0.5),
        riskScore: 98,
        anomalyScore: 5,
        refundStatus: 'pending_approval',
        declaredValue: 500,
      },
    }),
  ]);

  const counts = {
    customers: await prisma.customer.count(),
    vehicles: await prisma.vehicle.count(),
    shipments: await prisma.shipment.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
