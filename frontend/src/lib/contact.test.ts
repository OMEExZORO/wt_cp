import { describe, expect, it } from 'vitest'
import type { PublicBranch } from '../types/public'
import { branchAddress, branchPhones, directionsUrl, formatPhone, telHref } from './contact'

const moshi = {
  address_line: 'Gat No. 284, Near Shree Hospital, Dehu-Moshi Road, Tal. Haveli, Dist. Pune',
  postal_code: '411070',
  phone: '8380068696',
  phone_secondary: '8308849804',
  maps_url: null,
  address_is_placeholder: false,
} as PublicBranch

describe('contact helpers', () => {
  it('formats Indian numbers for display and tel links', () => {
    expect(formatPhone('9890094569')).toBe('+91 98900 94569')
    expect(formatPhone('+918308849804')).toBe('+91 83088 49804')
    expect(telHref('8308849804')).toBe('tel:+918308849804')
  })

  it('returns every phone number of a branch', () => {
    expect(branchPhones(moshi)).toEqual(['8380068696', '8308849804'])
    expect(branchPhones({ phone: '8380068693', phone_secondary: null })).toEqual(['8380068693'])
  })

  it('builds the address and a Google Maps search url from the address text', () => {
    expect(branchAddress(moshi)).toBe('Gat No. 284, Near Shree Hospital, Dehu-Moshi Road, Tal. Haveli, Dist. Pune - 411 070')
    expect(directionsUrl(moshi)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Gat%20No.%20284%2C%20Near%20Shree%20Hospital%2C%20Dehu-Moshi%20Road%2C%20Tal.%20Haveli%2C%20Dist.%20Pune%20-%20411%20070',
    )
  })
})
