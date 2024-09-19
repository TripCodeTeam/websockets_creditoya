export const ActiveAccountMail = ({
  completeName,
  message,
}: {
  completeName: string;
  message: string
}) => {
  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Roboto, sans-serif" />
    </mj-attributes>
    <mj-style inline="inline">
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap');
    </mj-style>
  </mj-head>

  <mj-body>
    <mj-section>
      <mj-column>
        <mj-image width="200px" src="https://res.cloudinary.com/dvquomppa/image/upload/v1717654334/credito_ya/cirm9vbdngqyxymcpfad.png"></mj-image>
      </mj-column>
    </mj-section>

    <mj-section>
      <mj-column>
        <mj-text font-size="15px" font-weight="bold">Estimado/a ${completeName}</mj-text>
        <mj-text font-size="14px" color="#388E3C">${message}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
};
