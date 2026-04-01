/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BusinessInfo {
  name: string;
  address: string;
  taxId: string;
  owner: string;
  businessLocation?: string;
}

export interface ClassSubject {
  id: string;
  grade: string;
  subject: string;
  subSubject: string;
}

export interface PPCTItem {
  id: string;
  grade: string;
  subject: string;
  subSubject: string;
  period: number;
  content: string;
  notes: string;
}

export interface LessonPlanRow {
  id: string;
  day: string;
  date: string;
  shift: string;
  grade: string;
  subject: string;
  subSubject: string;
  period: string;
  content: string;
  notes: string;
  // For Class Journal
  attendance?: string;
  comments?: string;
  signature?: string;
}

export interface LessonPlan {
  id: string;
  teacherName: string;
  week: string;
  startDate: string;
  endDate: string;
  rows: LessonPlanRow[];
}

export interface Student {
  id: string;
  stt: string;
  name: string;
  grade: string;
  school: string;
  parentName: string;
  phone: string;
  subject: string;
  registrationDate: string;
}

export interface FinancialConfig {
  reportPeriod: string;
  receiptDate: string;
  paymentDate: string;
  preparer: string;
  treasurer: string;
  taxCode: string;
}

export interface IncomeItem {
  id: string;
  stt: string;
  name: string;
  address: string;
  amount: number;
  date?: string;
}

export interface ExpenseItem {
  id: string;
  stt: string;
  name: string;
  address: string;
  content: string;
  amount: number;
  date?: string;
}
