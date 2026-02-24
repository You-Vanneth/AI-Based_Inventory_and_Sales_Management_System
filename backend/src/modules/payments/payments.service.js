import { pool } from "../../db/pool.js";

function round2(n) {
  return Number(n.toFixed(2));
}

function computePaymentStatus(totalPaid, grandTotal) {
  if (totalPaid <= 0) return "PENDING";
  if (totalPaid >= grandTotal) return "PAID";
  return "PARTIAL";
}

async function recalculateSalePaymentStatus(connection, saleId) {
  const [[sale]] = await connection.query(
    `SELECT grand_total FROM sales WHERE sale_id = ? AND deleted_at IS NULL LIMIT 1`,
    [saleId]
  );
  if (!sale) return null;

  const [[sumRow]] = await connection.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM payments
     WHERE sale_id = ? AND deleted_at IS NULL`,
    [saleId]
  );

  const totalPaid = round2(Number(sumRow.total_paid));
  const status = computePaymentStatus(totalPaid, Number(sale.grand_total));

  await connection.query(
    `UPDATE sales
     SET payment_status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE sale_id = ?`,
    [status, saleId]
  );

  return status;
}

export async function listPayments({ page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT p.payment_id, p.sale_id, p.payment_method, p.amount, p.paid_at,
            p.reference_no, p.note, p.received_by, u.full_name AS received_by_name
     FROM payments p
     LEFT JOIN users u ON u.user_id = p.received_by
     WHERE p.deleted_at IS NULL
     ORDER BY p.paid_at DESC, p.payment_id DESC
     LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  );

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM payments WHERE deleted_at IS NULL`
  );

  return { rows, total: countRow.total };
}

export async function getPaymentById(paymentId) {
  const [rows] = await pool.query(
    `SELECT payment_id, sale_id, payment_method, amount, paid_at,
            reference_no, note, received_by
     FROM payments
     WHERE payment_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [paymentId]
  );
  return rows[0] || null;
}

export async function addPaymentToSale(saleId, payload, actorId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [saleRows] = await connection.query(
      `SELECT sale_id FROM sales WHERE sale_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [saleId]
    );
    if (!saleRows[0]) {
      const err = new Error("Sale not found");
      err.statusCode = 404;
      err.errorCode = "SALE_NOT_FOUND";
      throw err;
    }

    const [result] = await connection.query(
      `INSERT INTO payments (
        sale_id, payment_method, amount, paid_at, reference_no, received_by, note
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`,
      [
        saleId,
        payload.payment_method,
        Number(payload.amount),
        payload.reference_no || null,
        actorId,
        payload.note || null
      ]
    );

    await recalculateSalePaymentStatus(connection, saleId);

    await connection.commit();
    return getPaymentById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deletePayment(paymentId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT payment_id, sale_id
       FROM payments
       WHERE payment_id = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [paymentId]
    );

    const payment = rows[0];
    if (!payment) {
      const err = new Error("Payment not found");
      err.statusCode = 404;
      err.errorCode = "PAYMENT_NOT_FOUND";
      throw err;
    }

    await connection.query(
      `UPDATE payments
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE payment_id = ?`,
      [paymentId]
    );

    await recalculateSalePaymentStatus(connection, payment.sale_id);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
