/**
 * Script to generate sample-patient-data.xlsx fixture using ExcelJS.
 * Run with: node tests/fixtures/excel/generate-fixture.cjs
 *
 * Replaces SheetJS (xlsx) which had unpatched ReDoS + Prototype Pollution CVEs.
 */

// Resolve exceljs from pnpm store since this script runs outside the workspace module resolution
const ExcelJS = require(require.resolve('exceljs', {
  paths: [
    require('path').resolve(__dirname, '../../../packages/core'),
    require('path').resolve(__dirname, '../../../node_modules/.pnpm/exceljs@4.4.0/node_modules'),
    __dirname,
  ],
}));
const path = require('path');

async function generate() {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Patients
  const patientsSheet = wb.addWorksheet('Patients');
  patientsSheet.columns = [
    { header: 'patient_id', key: 'patient_id' },
    { header: 'first_name', key: 'first_name' },
    { header: 'last_name', key: 'last_name' },
    { header: 'birth_date', key: 'birth_date' },
    { header: 'gender', key: 'gender' },
    { header: 'phone', key: 'phone' },
    { header: 'city', key: 'city' },
    { header: 'state', key: 'state' },
  ];

  const patients = [
    { patient_id: 'P001', first_name: 'John', last_name: 'Smith', birth_date: '1985-03-15', gender: 'male', phone: '555-0101', city: 'Springfield', state: 'IL' },
    { patient_id: 'P002', first_name: 'Mary', last_name: 'Johnson', birth_date: '1992-07-22', gender: 'female', phone: '555-0202', city: 'Chicago', state: 'IL' },
    { patient_id: 'P003', first_name: 'Robert', last_name: 'Williams', birth_date: '1970-11-08', gender: 'male', phone: '555-0303', city: 'Naperville', state: 'IL' },
    { patient_id: 'P004', first_name: 'Jennifer', last_name: 'Brown', birth_date: '1988-04-30', gender: 'female', phone: '555-0404', city: 'Rockford', state: 'IL' },
    { patient_id: 'P005', first_name: 'Michael', last_name: 'Davis', birth_date: '2001-09-17', gender: 'male', phone: '555-0505', city: 'Peoria', state: 'IL' },
  ];

  patients.forEach((p) => patientsSheet.addRow(p));

  // Sheet 2: Observations
  const obsSheet = wb.addWorksheet('Observations');
  obsSheet.columns = [
    { header: 'patient_id', key: 'patient_id' },
    { header: 'date', key: 'date' },
    { header: 'observation_type', key: 'observation_type' },
    { header: 'value', key: 'value' },
    { header: 'unit', key: 'unit' },
    { header: 'loinc_code', key: 'loinc_code' },
  ];

  const observations = [
    { patient_id: 'P001', date: '2024-01-10', observation_type: 'Heart Rate', value: 72, unit: 'bpm', loinc_code: '8867-4' },
    { patient_id: 'P001', date: '2024-01-10', observation_type: 'Blood Pressure', value: 120, unit: 'mmHg', loinc_code: '55284-4' },
    { patient_id: 'P002', date: '2024-01-11', observation_type: 'Heart Rate', value: 68, unit: 'bpm', loinc_code: '8867-4' },
    { patient_id: 'P002', date: '2024-01-11', observation_type: 'Body Weight', value: 65, unit: 'kg', loinc_code: '29463-7' },
    { patient_id: 'P003', date: '2024-01-12', observation_type: 'Blood Pressure', value: 135, unit: 'mmHg', loinc_code: '55284-4' },
    { patient_id: 'P003', date: '2024-01-12', observation_type: 'Body Temperature', value: 36.8, unit: 'C', loinc_code: '8310-5' },
    { patient_id: 'P004', date: '2024-01-13', observation_type: 'Heart Rate', value: 75, unit: 'bpm', loinc_code: '8867-4' },
    { patient_id: 'P004', date: '2024-01-13', observation_type: 'Oxygen Saturation', value: 98, unit: '%', loinc_code: '2708-6' },
    { patient_id: 'P005', date: '2024-01-14', observation_type: 'Body Weight', value: 80, unit: 'kg', loinc_code: '29463-7' },
    { patient_id: 'P005', date: '2024-01-14', observation_type: 'Body Temperature', value: 37.0, unit: 'C', loinc_code: '8310-5' },
  ];

  observations.forEach((o) => obsSheet.addRow(o));

  const outPath = path.join(__dirname, 'sample-patient-data.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log('Generated:', outPath);
}

generate().catch((err) => {
  console.error('Failed to generate fixture:', err);
  process.exit(1);
});
