import test from 'node:test';
import assert from 'node:assert/strict';
import routeData from '../database/data/routes_seed.json' with { type: 'json' };
import studentData from '../database/data/demo_students.json' with { type: 'json' };
import conductorData from '../database/data/demo_conductors.json' with { type: 'json' };

test('route seed has exactly 200 unique route codes and preserves source stop order', () => {
  assert.equal(routeData.routes.length, 200);
  assert.equal(new Set(routeData.routes.map((route) => route.routeCode)).size, 200);

  const directions = routeData.routes.flatMap((route) => route.directions);
  assert.equal(directions.length, 365);
  for (const direction of directions) {
    assert.ok(direction.stops.length > 0);
    assert.equal(direction.stops.length, direction.sourceStopCount);
  }
});

test('student pass seed contains 20 fictional test accounts only', () => {
  assert.equal(studentData.students.length, 20);
  assert.equal(new Set(studentData.students.map((student) => student.email)).size, 20);
  assert.equal(new Set(studentData.students.map((student) => student.passNumber)).size, 20);
  assert.ok(studentData.students.every((student) => student.email.endsWith('@example.test')));
  assert.ok(studentData.students.every((student) => student.verificationSource === 'demo_seed'));
  assert.ok(studentData.students.every((student) => !('phone' in student) && !('dateOfBirth' in student)));
});

test('conductor seed contains a fictional test assignment on a seeded route', () => {
  assert.equal(conductorData.conductors.length, 1);
  const [conductor] = conductorData.conductors;
  assert.ok(conductor.email.endsWith('@example.test'));
  assert.ok(conductor.employeeNumber.startsWith('DEMO-'));
  assert.ok(conductor.busRegistrationNumber.startsWith('TEST-'));
  assert.ok(routeData.routes.some((route) => route.routeCode === conductor.routeCode
    && route.directions.some((direction) => direction.direction === conductor.direction)));
});
