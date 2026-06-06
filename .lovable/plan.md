## Diagnóstico atual

- A chamada mais recente para `pagou-create-pix` chegou na Pagou em `/v2/transactions`.
- O erro atual não é mais CNPJ inválido, nem endereço, nem ausência de documento.
- A Pagou retornou:

```text
HTTP 422
PAYMENT_BLOCKED
Transaction blocked: payment policy ticket limit exceeded
```

- Isso indica que o payload já avançou na validação, mas a conta/política de pagamento da Pagou está bloqueando a transação de R$ 500 por limite de ticket.
- Sobre o recebedor: sim, o Pix deve ser gerado para a conta/chave mestre da DRIVER ADS configurada nas credenciais Pagou. O CNPJ da Pizzaria entra como documento do pagador/comprador (`buyer.document`) para validação/compliance, não como chave recebedora.

## Plano de correção

1. **Manter o CNPJ do anunciante no buyer quando válido**
   - Garantir que `buyer.document` seja enviado sempre que o CNPJ/CPF cadastrado for válido.
   - Se o documento estiver ausente ou inválido, retornar uma mensagem clara antes de chamar a Pagou, porque a Pagou agora exige documento para Pix.

2. **Tratar `PAYMENT_BLOCKED` de forma específica**
   - Quando a Pagou retornar `PAYMENT_BLOCKED` / `payment policy ticket limit exceeded`, a Edge Function não deve devolver apenas “Edge Function returned a non-2xx status code”.
   - Retornar erro de negócio claro para o frontend, por exemplo:

```text
A Pagou bloqueou esta cobrança porque o valor excede o limite de ticket configurado na conta. Ajuste o limite na Pagou ou use um plano com valor permitido.
```

3. **Melhorar o erro exibido no checkout Pix**
   - Ajustar o componente `PixCheckout` para mostrar a mensagem detalhada retornada pela função.
   - Evitar que o usuário veja apenas o 502 genérico.

4. **Preservar logs úteis para suporte**
   - Continuar salvando o corpo retornado pela Pagou em `pagou_api_logs`.
   - Se possível, capturar o `requestId` da Pagou mesmo quando ele vem só dentro do body, para facilitar suporte com a Pagou.

5. **Validar depois da implementação**
   - Testar a função novamente com a campanha da Pizzaria Bons Amigos.
   - Resultado esperado se o limite continuar bloqueando: mensagem amigável e específica no app.
   - Resultado esperado após a Pagou liberar o limite de ticket: QR Code Pix gerado normalmente para recebimento pela DRIVER ADS.