// Probity — VIES VAT validation.
// Calls the official European Commission VIES SOAP service. No API key required.
// This is a real-time check against each member state's national VAT register.
// Accepts: { countryCode, vatNumber }
// Returns: { valid, name, address, countryCode, vatNumber, requestDate, fault, source }

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

function pick(xml, tag) {
  const m = xml.match(new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`));
  return m ? m[1].trim() : null;
}

exports.handler = async (event) => {
  try {
    const { countryCode, vatNumber } = JSON.parse(event.body || "{}");
    if (!countryCode || !vatNumber) {
      return { statusCode: 400, body: JSON.stringify({ error: "countryCode and vatNumber are required" }) };
    }

    const cc = String(countryCode).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    const vn = String(vatNumber).replace(/[^0-9A-Za-z]/g, "");

    const soap =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
      `xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">` +
      `<soapenv:Header/><soapenv:Body><urn:checkVat>` +
      `<urn:countryCode>${cc}</urn:countryCode>` +
      `<urn:vatNumber>${vn}</urn:vatNumber>` +
      `</urn:checkVat></soapenv:Body></soapenv:Envelope>`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);

    let xml = "";
    try {
      const r = await fetch(VIES_URL, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
        body: soap,
        signal: ctrl.signal,
      });
      xml = await r.text();
    } finally {
      clearTimeout(t);
    }

    const fault = pick(xml, "faultstring");
    const valid = /<(?:[a-zA-Z0-9]+:)?valid>\s*true\s*<\/(?:[a-zA-Z0-9]+:)?valid>/i.test(xml);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valid,
        name: pick(xml, "name"),
        address: pick(xml, "address"),
        countryCode: cc,
        vatNumber: vn,
        requestDate: pick(xml, "requestDate"),
        fault: fault || null,
        source: "European Commission VIES",
      }),
    };
  } catch (e) {
    // VIES national registries go offline intermittently; report it rather than crashing.
    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: null,
        unavailable: true,
        error: String(e && e.message ? e.message : e),
        source: "European Commission VIES",
      }),
    };
  }
};
